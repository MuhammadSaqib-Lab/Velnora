import { safeFetchText } from '../../leadFinder/security/safeFetch.js'
import type { AuditContext, LinkCheck, PageSpeedResult } from './checks.js'
import { parsePage, parseRobots, parseSitemap, registrableHost, type PageFacts } from './pageParser.js'
import { fetchPageSpeed } from './pagespeed.js'

/**
 * Fetches what an audit needs, within a hard budget:
 *   1 main page + robots.txt + sitemap + ≤5 more internal pages + ≤15 link
 *   checks, ≤4 requests at a time, ≤45 s overall. Every request goes through
 *   safeFetchText — the same SSRF-hardened fetcher the Lead Finder uses
 *   (private/loopback/link-local ranges refused after DNS resolution, every
 *   redirect hop re-validated, 8 s timeout, response-size cap).
 *
 * The audited page controls which URLs we follow, but only inside those
 * bounds and only to read a status line or a small HTML document.
 */
const USER_AGENT = 'VelnoraSEOAudit/1.0 (+https://www.velnora.com)'
const MAX_EXTRA_PAGES = 5
const MAX_LINK_CHECKS = 15
const CONCURRENCY = 4
const OVERALL_BUDGET_MS = 45_000
const PAGE_BYTES = 2 * 1024 * 1024

const ASSET_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|rar|gz|mp4|mp3|mov|avi|css|js|json|xml|txt|woff2?|ttf|eot|docx?|xlsx?|pptx?)$/i

async function pool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (true) {
        const index = next++
        if (index >= items.length) return
        results[index] = await worker(items[index]!)
      }
    }),
  )
  return results
}

type Fetched = { kind: 'page'; facts: PageFacts } | { kind: 'error'; url: string; status: number | null; redirects: number }

/** A page we can analyze, or an error status worth reporting (a 404 internal page is a broken link). */
async function fetchFacts(url: string): Promise<Fetched | null> {
  const result = await safeFetchText(url, { userAgent: USER_AGENT, maxBytes: PAGE_BYTES })
  if (!result) return { kind: 'error', url, status: null, redirects: 0 }
  if (result.status >= 400) return { kind: 'error', url: result.finalUrl, status: result.status, redirects: result.redirects.length }
  const contentType = result.headers.get('content-type') ?? ''
  if (contentType && !/html|xml/i.test(contentType)) return null // not a page we can analyze
  return { kind: 'page', facts: parsePage(result.text, { url: result.finalUrl, status: result.status, durationMs: result.durationMs, redirects: result.redirects, headers: result.headers }) }
}

export async function crawlSite(
  inputUrl: string,
  opts: { kind: AuditContext['kind']; includePageSpeed: boolean },
): Promise<AuditContext | null> {
  const deadline = Date.now() + OVERALL_BUDGET_MS
  let truncated = false
  const within = () => {
    if (Date.now() < deadline) return true
    truncated = true
    return false
  }

  const mainFetched = await fetchFacts(inputUrl)
  // The audited address itself must load as a page; anything else is a failed audit, not a report.
  if (!mainFetched || mainFetched.kind !== 'page') return null
  const main = mainFetched.facts
  const domain = registrableHost(new URL(main.url).hostname)
  const origin = new URL(main.url).origin

  // Google measures the page itself; start now so it overlaps the crawl.
  const pageSpeedPromise: Promise<PageSpeedResult | null> | null = opts.includePageSpeed ? fetchPageSpeed(main.url) : null

  const [robotsRes, sitemapGuess] = await Promise.all([
    safeFetchText(`${origin}/robots.txt`, { userAgent: USER_AGENT, maxBytes: 200 * 1024 }),
    Promise.resolve(`${origin}/sitemap.xml`),
  ])
  const robots = parseRobots(robotsRes?.status ?? null, robotsRes?.text ?? '')

  let sitemapUrl = sitemapGuess
  const declared = robots.sitemaps.find((s) => {
    try {
      return registrableHost(new URL(s).hostname) === domain // only the audited site's own sitemap
    } catch {
      return false
    }
  })
  if (declared) sitemapUrl = declared
  const sitemapRes = within() ? await safeFetchText(sitemapUrl, { userAgent: USER_AGENT, maxBytes: 1024 * 1024 }) : null
  const sitemap = parseSitemap(sitemapRes?.status ?? null, sitemapRes?.text ?? '')

  // A few more internal pages, for duplicate-title / thin-content / linking checks.
  const candidates = main.internalLinks.filter((u) => !ASSET_EXTENSIONS.test(new URL(u).pathname) && u.replace(/\/$/, '') !== main.url.replace(/\/$/, ''))
  const toCrawl = candidates.slice(0, MAX_EXTRA_PAGES)
  const fetched = (await pool(toCrawl, CONCURRENCY, async (u) => (within() ? fetchFacts(u) : null))).filter((f): f is Fetched => f !== null)
  const crawled = fetched.filter((f): f is Extract<Fetched, { kind: 'page' }> => f.kind === 'page').map((f) => f.facts)
  // Internal pages that failed to load are broken links, reported alongside the sampled link checks.
  const brokenInternal: LinkCheck[] = fetched
    .filter((f): f is Extract<Fetched, { kind: 'error' }> => f.kind === 'error')
    .map((f) => ({ url: f.url, status: f.status, internal: true, redirects: f.redirects }))

  // Link check sample: remaining internal links first, then external links on distinct hosts.
  const seenHosts = new Set<string>()
  const external = main.externalLinks.filter((u) => {
    const host = new URL(u).hostname
    if (seenHosts.has(host)) return false
    seenHosts.add(host)
    return true
  })
  const crawledSet = new Set(toCrawl)
  const sample: Array<{ url: string; internal: boolean }> = [
    ...candidates.filter((u) => !crawledSet.has(u)).map((url) => ({ url, internal: true })),
    ...external.map((url) => ({ url, internal: false })),
  ].slice(0, MAX_LINK_CHECKS)

  const linkChecks: LinkCheck[] = await pool(sample, CONCURRENCY, async (item): Promise<LinkCheck> => {
    if (!within()) return { url: item.url, status: -1, internal: item.internal, redirects: 0 }
    let res = await safeFetchText(item.url, { method: 'HEAD', userAgent: USER_AGENT, timeoutMs: 6000, maxBytes: 64 * 1024 })
    if (res && (res.status === 405 || res.status === 501)) {
      res = await safeFetchText(item.url, { method: 'GET', userAgent: USER_AGENT, timeoutMs: 6000, maxBytes: 200 * 1024 })
    }
    return { url: item.url, status: res ? res.status : null, internal: item.internal, redirects: res?.redirects.length ?? 0 }
  })
  // Links skipped because the budget ran out are not "broken" — drop them from the sample.
  const checkedLinks = linkChecks.filter((l) => l.status !== -1)

  let pageSpeed: AuditContext['pageSpeed'] = 'SKIPPED'
  if (pageSpeedPromise) pageSpeed = await pageSpeedPromise

  return { inputUrl, kind: opts.kind, main, pages: crawled, robots, sitemap, linkChecks: [...brokenInternal, ...checkedLinks], pageSpeed, truncated }
}
