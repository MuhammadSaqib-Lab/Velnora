import * as cheerio from 'cheerio'
import { sanitizeLine } from '../text.js'

/**
 * Turns one fetched HTML page into plain facts. Everything here is observed
 * from the response (present/absent, counts, short sanitized excerpts) — no
 * scoring, no guessing. Page text is untrusted: it is only ever measured or
 * excerpted (control characters stripped, length-capped), never interpreted
 * as instructions and never sent to the AI.
 */
export interface PageFacts {
  url: string
  status: number
  durationMs: number
  htmlBytes: number
  redirects: string[]
  title: string | null
  metaDescription: string | null
  canonical: string | null
  robotsMeta: string | null
  xRobotsTag: string | null
  contentEncoding: string | null
  lang: string | null
  hasViewport: boolean
  hasCharset: boolean
  h1: string[]
  headingLevels: number[]
  imgTotal: number
  imgMissingAlt: number
  internalLinks: string[]
  externalLinks: string[]
  jsonLdTypes: string[]
  og: { title: boolean; description: boolean; image: boolean }
  hasTwitterCard: boolean
  wordCount: number
  hasTel: boolean
  hasMapLink: boolean
}

const MAX_LINKS = 200

export function registrableHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function collectJsonLdTypes(node: unknown, out: Set<string>, depth = 0): void {
  if (depth > 5 || out.size >= 20 || node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdTypes(item, out, depth + 1)
    return
  }
  const record = node as Record<string, unknown>
  const type = record['@type']
  if (typeof type === 'string') out.add(sanitizeLine(type, 60))
  else if (Array.isArray(type)) for (const t of type) if (typeof t === 'string') out.add(sanitizeLine(t, 60))
  for (const value of Object.values(record)) collectJsonLdTypes(value, out, depth + 1)
}

export function parsePage(
  html: string,
  meta: { url: string; status: number; durationMs: number; redirects: string[]; headers: Headers },
): PageFacts {
  const $ = cheerio.load(html)
  const pageUrl = new URL(meta.url)
  const domain = registrableHost(pageUrl.hostname)

  const links = { internal: new Set<string>(), external: new Set<string>() }
  let hasTel = false
  let hasMapLink = false
  $('a[href]').each((_i, el) => {
    const href = ($(el).attr('href') ?? '').trim()
    if (!href || href.startsWith('#') || /^(?:javascript|data|vbscript):/i.test(href)) return
    if (/^tel:/i.test(href)) {
      hasTel = true
      return
    }
    if (/^mailto:/i.test(href)) return
    let resolved: URL
    try {
      resolved = new URL(href, pageUrl)
    } catch {
      return
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return
    if (/(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(resolved.href)) hasMapLink = true
    resolved.hash = ''
    const target = resolved.toString()
    const bucket = registrableHost(resolved.hostname) === domain ? links.internal : links.external
    if (bucket.size < MAX_LINKS) bucket.add(target)
  })
  if ($('iframe[src*="google.com/maps"]').length > 0) hasMapLink = true

  const headingLevels: number[] = []
  $('h1,h2,h3,h4,h5,h6').each((_i, el) => {
    headingLevels.push(Number(el.tagName.slice(1)))
  })

  const images = $('img')
  let missingAlt = 0
  images.each((_i, el) => {
    const alt = $(el).attr('alt')
    if (alt === undefined || alt.trim() === '') missingAlt += 1
  })

  const jsonLd = new Set<string>()
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      collectJsonLdTypes(JSON.parse($(el).contents().text()), jsonLd)
    } catch {
      /* malformed JSON-LD is simply not counted */
    }
  })

  const bodyClone = $('body').clone()
  bodyClone.find('script,style,noscript,template').remove()
  const words = bodyClone.text().split(/\s+/).filter(Boolean).length

  const metaContent = (selector: string) => $(selector).first().attr('content')?.trim() || null

  return {
    url: meta.url,
    status: meta.status,
    durationMs: meta.durationMs,
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    redirects: meta.redirects,
    title: sanitizeLine($('head title').first().text(), 300) || null,
    metaDescription: sanitizeLine(metaContent('meta[name="description" i]'), 500) || null,
    canonical: $('link[rel="canonical" i]').first().attr('href')?.trim() || null,
    robotsMeta: metaContent('meta[name="robots" i]')?.toLowerCase() ?? null,
    xRobotsTag: meta.headers.get('x-robots-tag')?.toLowerCase() ?? null,
    contentEncoding: meta.headers.get('content-encoding'),
    lang: $('html').attr('lang')?.trim() || null,
    hasViewport: $('meta[name="viewport" i]').length > 0,
    hasCharset: $('meta[charset]').length > 0 || /charset=/i.test(meta.headers.get('content-type') ?? ''),
    h1: $('h1')
      .map((_i, el) => sanitizeLine($(el).text(), 160))
      .get()
      .filter(Boolean),
    headingLevels,
    imgTotal: images.length,
    imgMissingAlt: missingAlt,
    internalLinks: [...links.internal],
    externalLinks: [...links.external],
    jsonLdTypes: [...jsonLd],
    og: { title: Boolean(metaContent('meta[property="og:title"]')), description: Boolean(metaContent('meta[property="og:description"]')), image: Boolean(metaContent('meta[property="og:image"]')) },
    hasTwitterCard: $('meta[name="twitter:card" i]').length > 0,
    wordCount: words,
    hasTel,
    hasMapLink,
  }
}

// ───────────────────────────── robots.txt / sitemap ──────────────────────────

export interface RobotsInfo {
  found: boolean
  blocksAll: boolean
  sitemaps: string[]
}

export function parseRobots(status: number | null, text: string): RobotsInfo {
  if (status === null || status < 200 || status >= 300) return { found: false, blocksAll: false, sitemaps: [] }
  let inStarGroup = false
  let blocksAll = false
  const sitemaps: string[] = []
  for (const rawLine of text.split(/\r?\n/).slice(0, 2000)) {
    const line = rawLine.replace(/#.*/, '').trim()
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line)
    if (!match) continue
    const field = match[1]!.toLowerCase()
    const value = match[2]!.trim()
    if (field === 'user-agent') inStarGroup = value === '*'
    else if (field === 'disallow' && inStarGroup && value === '/') blocksAll = true
    else if (field === 'sitemap' && value && sitemaps.length < 10) sitemaps.push(value)
  }
  return { found: true, blocksAll, sitemaps }
}

export interface SitemapInfo {
  found: boolean
  valid: boolean
  urlCount: number
  isIndex: boolean
}

export function parseSitemap(status: number | null, text: string): SitemapInfo {
  if (status === null || status < 200 || status >= 300) return { found: false, valid: false, urlCount: 0, isIndex: false }
  const isIndex = /<sitemapindex[\s>]/i.test(text)
  const valid = isIndex || /<urlset[\s>]/i.test(text)
  const urlCount = valid ? Math.min((text.match(/<loc>/gi) ?? []).length, 50000) : 0
  return { found: true, valid, urlCount, isIndex }
}
