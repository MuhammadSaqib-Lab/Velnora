import { sanitizeLine } from '../text.js'
import { registrableHost, type PageFacts, type RobotsInfo, type SitemapInfo } from './pageParser.js'

/**
 * The SEO audit's rules. Pure functions of data the crawler actually
 * observed — no network, no AI, no randomness — so the same input always
 * gives the same report. Every row carries one of four labels:
 *   VERIFIED       directly observed (a tag is missing, a link returns 404…)
 *   RECOMMENDATION advice derived from verified findings, with impact / effort
 *                  (1–5) and confidence, for prioritisation
 *   ESTIMATE       a qualitative opportunity read — never a traffic number
 *   UNAVAILABLE    something we cannot know without a data source that is not
 *                  connected (rankings, search volume, traffic, backlinks…)
 */

export type FindingLabel = 'VERIFIED' | 'RECOMMENDATION' | 'ESTIMATE' | 'UNAVAILABLE'
export type CheckResult = 'PASS' | 'WARN' | 'FAIL' | 'INFO'
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface FindingDraft {
  checkKey: string
  category: string
  label: FindingLabel
  result?: CheckResult
  title: string
  detail: string
  evidence?: Record<string, unknown>
  pageUrl?: string
  impact?: number
  effort?: number
  confidence?: Confidence
}

export interface LinkCheck {
  url: string
  status: number | null
  internal: boolean
  redirects: number
}

export interface PageSpeedResult {
  performanceScore: number | null
  lcpMs: number | null
  cls: number | null
  tbtMs: number | null
  fcpMs: number | null
  speedIndexMs: number | null
  field: {
    lcp?: { ms: number; category: string }
    cls?: { value: number; category: string }
    inp?: { ms: number; category: string }
  } | null
}

export interface AuditContext {
  inputUrl: string
  kind: 'OWN' | 'CLIENT' | 'COMPETITOR'
  main: PageFacts
  pages: PageFacts[]
  robots: RobotsInfo
  sitemap: SitemapInfo
  linkChecks: LinkCheck[]
  /** 'SKIPPED' = not requested; null = requested but Google's API returned nothing usable. */
  pageSpeed: PageSpeedResult | 'SKIPPED' | null
  truncated: boolean
}

const stripWww = (url: string): string => {
  try {
    const u = new URL(url)
    return `${u.protocol}//${registrableHost(u.hostname)}${u.pathname.replace(/\/+$/, '')}${u.search}`
  } catch {
    return url
  }
}

export function buildFindings(ctx: AuditContext): FindingDraft[] {
  const out: FindingDraft[] = []
  const wantAdvice = ctx.kind !== 'COMPETITOR' // advice is for sites Velnora is working on, not for a competitor's site
  const m = ctx.main

  const check = (checkKey: string, category: string, result: CheckResult, title: string, detail: string, evidence?: Record<string, unknown>, pageUrl?: string) =>
    out.push({ checkKey, category, label: 'VERIFIED', result, title, detail, evidence, pageUrl })

  const advise = (checkKey: string, category: string, title: string, detail: string, impact: number, effort: number, confidence: Confidence) => {
    if (wantAdvice) out.push({ checkKey: `${checkKey}.fix`, category, label: 'RECOMMENDATION', title, detail, impact, effort, confidence })
  }

  // ───────────────────────────── technical ─────────────────────────────
  const https = m.url.startsWith('https://')
  check('tech.https', 'TECHNICAL', https ? 'PASS' : 'FAIL', 'Served over HTTPS', https ? 'The page loads over HTTPS.' : 'The page is served over plain HTTP.', { finalUrl: m.url })
  if (!https) advise('tech.https', 'TECHNICAL', 'Move the site to HTTPS', 'Install a TLS certificate and redirect all HTTP URLs to HTTPS. Browsers warn on HTTP pages and HTTPS is a lightweight ranking signal.', 4, 2, 'HIGH')

  check('tech.status', 'TECHNICAL', m.status === 200 ? 'PASS' : 'WARN', 'Page responds with HTTP 200', `The page returned HTTP ${m.status}.`, { status: m.status })

  const hops = m.redirects.length
  check(
    'tech.redirects',
    'TECHNICAL',
    hops <= 1 ? 'PASS' : 'WARN',
    hops === 0 ? 'No redirects to the page' : `${hops} redirect${hops === 1 ? '' : 's'} before the page`,
    hops <= 1 ? 'The address resolves with at most one redirect.' : 'The address passes through several redirects before loading, which slows crawling and loading.',
    { chain: m.redirects.map((u) => sanitizeLine(u, 200)).slice(0, 5) },
  )
  if (hops > 1) advise('tech.redirects', 'TECHNICAL', 'Shorten the redirect chain', 'Redirect each old address straight to its final destination in a single step.', 2, 2, 'HIGH')

  check('tech.viewport', 'TECHNICAL', m.hasViewport ? 'PASS' : 'FAIL', 'Mobile viewport tag', m.hasViewport ? 'A responsive viewport meta tag is present.' : 'No viewport meta tag was found; the page is unlikely to adapt to phone screens.')
  if (!m.hasViewport) advise('tech.viewport', 'TECHNICAL', 'Add a responsive viewport meta tag', 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and make sure the layout is responsive. Google indexes the mobile version of pages first.', 5, 2, 'HIGH')

  check('tech.lang', 'TECHNICAL', m.lang ? 'PASS' : 'WARN', 'Page language declared', m.lang ? `The page declares lang="${sanitizeLine(m.lang, 20)}".` : 'No lang attribute on the <html> element.')
  if (!m.lang) advise('tech.lang', 'TECHNICAL', 'Declare the page language', 'Add lang="en" (or the right language code) to the <html> tag to help search engines and assistive technology.', 1, 1, 'HIGH')

  check('tech.compression', 'TECHNICAL', m.contentEncoding ? 'PASS' : 'WARN', 'Response compression', m.contentEncoding ? `The server compresses responses (${sanitizeLine(m.contentEncoding, 20)}).` : 'The server did not report compression for the HTML response.', { contentEncoding: m.contentEncoding })
  if (!m.contentEncoding) advise('tech.compression', 'TECHNICAL', 'Enable gzip or Brotli compression', 'Compress HTML, CSS and JavaScript responses at the server or CDN to cut transfer size.', 2, 1, 'MEDIUM')

  // The timing below is measured from Velnora's server, not from real visitors.
  check('tech.responseTime', 'PERFORMANCE', m.durationMs > 2500 ? 'WARN' : 'INFO', 'Response time measured by this audit', `The page took ${m.durationMs} ms to download from Velnora's server. This is a single measurement from one location, not real-visitor data.`, { ms: m.durationMs })
  check('tech.htmlSize', 'PERFORMANCE', m.htmlBytes > 1_000_000 ? 'WARN' : 'INFO', 'HTML document size', `The HTML document is ${(m.htmlBytes / 1024).toFixed(0)} KB.`, { bytes: m.htmlBytes })

  // ─────────────────────────── indexability ────────────────────────────
  const noindex = (value: string | null) => value !== null && /\bnoindex\b/.test(value)
  check('index.metaRobots', 'INDEXABILITY', noindex(m.robotsMeta) ? 'FAIL' : 'PASS', 'Meta robots allows indexing', noindex(m.robotsMeta) ? `The page has a robots meta tag with noindex (${sanitizeLine(m.robotsMeta, 60)}), so search engines are told not to index it.` : 'No noindex directive in the robots meta tag.', { robotsMeta: m.robotsMeta })
  check('index.xRobots', 'INDEXABILITY', noindex(m.xRobotsTag) ? 'FAIL' : 'PASS', 'X-Robots-Tag allows indexing', noindex(m.xRobotsTag) ? 'The server sends an X-Robots-Tag header with noindex.' : 'No noindex in the X-Robots-Tag header.')
  if (noindex(m.robotsMeta) || noindex(m.xRobotsTag)) advise('index.noindex', 'INDEXABILITY', 'Remove the noindex directive if the page should rank', 'A noindex directive keeps the page out of search results. Remove it from the meta tag or header unless it is intentional.', 5, 1, 'HIGH')

  check('index.robotsTxt', 'INDEXABILITY', ctx.robots.found ? (ctx.robots.blocksAll ? 'FAIL' : 'PASS') : 'WARN', 'robots.txt', !ctx.robots.found ? 'No robots.txt was found at the site root.' : ctx.robots.blocksAll ? 'robots.txt disallows the whole site for all crawlers (Disallow: /).' : 'robots.txt is present and does not block the whole site.', { found: ctx.robots.found, blocksAll: ctx.robots.blocksAll })
  if (ctx.robots.blocksAll) advise('index.robotsTxt', 'INDEXABILITY', 'Stop blocking the whole site in robots.txt', 'Disallow: / for all crawlers prevents search engines from crawling the site. Remove it unless the site is intentionally private.', 5, 1, 'HIGH')
  else if (!ctx.robots.found) advise('index.robotsTxt', 'INDEXABILITY', 'Add a robots.txt file', 'Add a simple robots.txt that allows crawling and points to your sitemap.', 1, 1, 'MEDIUM')

  const sitemapState: CheckResult = ctx.sitemap.found && ctx.sitemap.valid ? 'PASS' : 'WARN'
  check('index.sitemap', 'INDEXABILITY', sitemapState, 'XML sitemap', !ctx.sitemap.found ? 'No sitemap was found at /sitemap.xml or in robots.txt.' : !ctx.sitemap.valid ? 'A sitemap file exists but is not valid sitemap XML.' : `A valid sitemap was found (${ctx.sitemap.urlCount} ${ctx.sitemap.isIndex ? 'sitemap entries' : 'URLs'}).`, { found: ctx.sitemap.found, valid: ctx.sitemap.valid, urlCount: ctx.sitemap.urlCount })
  if (sitemapState === 'WARN') advise('index.sitemap', 'INDEXABILITY', 'Publish a valid XML sitemap', 'Generate a sitemap listing your important pages, reference it in robots.txt and submit it in Google Search Console.', 3, 1, 'HIGH')

  const canonicalState = !m.canonical ? 'WARN' : stripWww(new URL(m.canonical, m.url).toString()) === stripWww(m.url) ? 'PASS' : 'WARN'
  check('index.canonical', 'INDEXABILITY', canonicalState, 'Canonical URL', !m.canonical ? 'No canonical link tag was found.' : canonicalState === 'PASS' ? 'The canonical URL points to this page.' : 'The canonical URL points to a different address than the one audited.', { canonical: m.canonical ? sanitizeLine(m.canonical, 200) : null })
  if (canonicalState === 'WARN') advise('index.canonical', 'INDEXABILITY', !m.canonical ? 'Add a canonical link tag' : 'Review the canonical URL', 'Add <link rel="canonical"> pointing to the preferred version of each page so duplicate URLs do not compete.', 3, 1, 'MEDIUM')

  // ───────────────────────────── on-page ──────────────────────────────
  const titleLen = m.title?.length ?? 0
  const titleState: CheckResult = !m.title ? 'FAIL' : titleLen < 30 || titleLen > 60 ? 'WARN' : 'PASS'
  check('page.title', 'ON_PAGE', titleState, 'Title tag', !m.title ? 'The page has no <title> tag.' : `The title is ${titleLen} characters${titleLen < 30 ? ' (short)' : titleLen > 60 ? ' (may be truncated in results)' : ' (a good length)'}.`, { length: titleLen, excerpt: m.title ? sanitizeLine(m.title, 120) : null }, m.url)
  if (titleState !== 'PASS') advise('page.title', 'ON_PAGE', 'Write a unique, descriptive title (about 30–60 characters)', 'Lead with the main service and location or benefit, and keep it unique per page. Titles are one of the strongest on-page signals and appear in results.', 4, 1, 'HIGH')

  const descLen = m.metaDescription?.length ?? 0
  const descState: CheckResult = !m.metaDescription ? 'FAIL' : descLen < 70 || descLen > 160 ? 'WARN' : 'PASS'
  check('page.metaDescription', 'ON_PAGE', descState, 'Meta description', !m.metaDescription ? 'The page has no meta description.' : `The meta description is ${descLen} characters${descLen < 70 ? ' (short)' : descLen > 160 ? ' (likely truncated)' : ''}.`, { length: descLen, excerpt: m.metaDescription ? sanitizeLine(m.metaDescription, 160) : null }, m.url)
  if (descState !== 'PASS') advise('page.metaDescription', 'ON_PAGE', 'Write a compelling meta description (about 70–160 characters)', 'Summarize the page and include a call to action. It does not directly affect rankings but strongly influences click-through.', 3, 1, 'HIGH')

  const h1State: CheckResult = m.h1.length === 1 ? 'PASS' : m.h1.length === 0 ? 'FAIL' : 'WARN'
  check('page.h1', 'ON_PAGE', h1State, 'Single H1 heading', m.h1.length === 0 ? 'The page has no H1 heading.' : m.h1.length === 1 ? 'The page has exactly one H1.' : `The page has ${m.h1.length} H1 headings.`, { count: m.h1.length, h1: m.h1.slice(0, 3) }, m.url)
  if (h1State !== 'PASS') advise('page.h1', 'ON_PAGE', 'Use exactly one descriptive H1', 'Give each page one H1 that states its main topic, then structure the rest with H2/H3.', 3, 1, 'HIGH')

  let skipped = false
  for (let i = 1; i < m.headingLevels.length; i++) if (m.headingLevels[i]! > m.headingLevels[i - 1]! + 1) skipped = true
  check('page.headingOrder', 'ON_PAGE', skipped ? 'WARN' : 'PASS', 'Heading hierarchy', skipped ? 'Heading levels skip a step (for example H1 straight to H3).' : 'Heading levels follow a logical order.', { sequence: m.headingLevels.slice(0, 40).join(',') }, m.url)
  if (skipped) advise('page.headingOrder', 'ON_PAGE', 'Fix the heading hierarchy', 'Do not skip heading levels; use H2 under H1, H3 under H2. This helps both readers and crawlers understand structure.', 2, 1, 'MEDIUM')

  if (m.imgTotal > 0) {
    const ratio = m.imgMissingAlt / m.imgTotal
    const altState: CheckResult = m.imgMissingAlt === 0 ? 'PASS' : ratio > 0.3 ? 'FAIL' : 'WARN'
    check('page.imageAlt', 'ON_PAGE', altState, 'Image alt text', m.imgMissingAlt === 0 ? `All ${m.imgTotal} images have alt text.` : `${m.imgMissingAlt} of ${m.imgTotal} images have no alt text.`, { total: m.imgTotal, missing: m.imgMissingAlt }, m.url)
    if (altState !== 'PASS') advise('page.imageAlt', 'ON_PAGE', `Add alt text to ${m.imgMissingAlt} image${m.imgMissingAlt === 1 ? '' : 's'}`, 'Describe each meaningful image in a short, natural phrase. Alt text improves accessibility and image search.', 3, 2, 'HIGH')
  }

  const ogComplete = m.og.title && m.og.description && m.og.image
  check('page.openGraph', 'ON_PAGE', ogComplete ? 'PASS' : 'WARN', 'Social sharing (Open Graph) tags', ogComplete ? 'og:title, og:description and og:image are present.' : 'One or more Open Graph tags are missing, so shared links may look plain.', { ...m.og, twitterCard: m.hasTwitterCard })
  if (!ogComplete) advise('page.openGraph', 'ON_PAGE', 'Add Open Graph tags', 'Add og:title, og:description and og:image (and a Twitter card) so links look good when shared on social platforms.', 2, 1, 'HIGH')

  // ───────────────────────────── content ──────────────────────────────
  check('content.wordCount', 'CONTENT', m.wordCount < 300 ? 'WARN' : 'INFO', 'Amount of page text', `The page has about ${m.wordCount} words of visible text.${m.wordCount < 300 ? ' Very little text gives search engines less to understand.' : ''}`, { words: m.wordCount }, m.url)
  if (m.wordCount < 300) advise('content.wordCount', 'CONTENT', 'Add more useful, original content', 'Explain what you offer, who it is for, and answer common questions in the page text. Quality and relevance matter more than length.', 3, 3, 'MEDIUM')

  // Crawled pages: duplicates.
  const allPages = [m, ...ctx.pages]
  if (allPages.length > 1) {
    const dup = (values: Array<string | null>) => {
      const seen = new Map<string, number>()
      for (const v of values) if (v) seen.set(v.toLowerCase(), (seen.get(v.toLowerCase()) ?? 0) + 1)
      return [...seen.entries()].filter(([, n]) => n > 1).length
    }
    const dupTitles = dup(allPages.map((p) => p.title))
    const dupDescs = dup(allPages.map((p) => p.metaDescription))
    check('content.duplicateTitles', 'CONTENT', dupTitles > 0 ? 'WARN' : 'PASS', 'Unique titles across crawled pages', dupTitles > 0 ? `${dupTitles} title${dupTitles === 1 ? ' is' : 's are'} used on more than one of the ${allPages.length} pages checked.` : `The ${allPages.length} pages checked have distinct titles.`, { pagesChecked: allPages.length })
    if (dupTitles > 0) advise('content.duplicateTitles', 'CONTENT', 'Give every page its own title', 'Duplicate titles make it harder for search engines to tell pages apart. Write a unique title for each page.', 3, 2, 'HIGH')
    check('content.duplicateDescriptions', 'CONTENT', dupDescs > 0 ? 'WARN' : 'PASS', 'Unique meta descriptions across crawled pages', dupDescs > 0 ? `${dupDescs} meta description${dupDescs === 1 ? ' is' : 's are'} repeated across the pages checked.` : 'Meta descriptions are distinct across the pages checked.')
    const missingTitle = ctx.pages.filter((p) => !p.title).length
    if (missingTitle > 0) check('content.pagesMissingTitle', 'CONTENT', 'WARN', 'Crawled pages without a title', `${missingTitle} of ${ctx.pages.length} additional pages have no title tag.`, { pages: ctx.pages.filter((p) => !p.title).map((p) => sanitizeLine(p.url, 200)).slice(0, 5) })
  }

  // ───────────────────────────── links ────────────────────────────────
  const internalCount = m.internalLinks.length
  check('links.internal', 'LINKS', internalCount < 3 ? 'WARN' : 'INFO', 'Internal links on the page', `The page links to ${internalCount} internal page${internalCount === 1 ? '' : 's'} and ${m.externalLinks.length} external address${m.externalLinks.length === 1 ? '' : 'es'}.`, { internal: internalCount, external: m.externalLinks.length }, m.url)
  if (internalCount < 3) advise('links.internal', 'LINKS', 'Strengthen internal linking', 'Link from this page to your key service pages and related content using descriptive anchor text. Internal links help crawlers discover pages and spread relevance.', 3, 2, 'MEDIUM')

  if (ctx.linkChecks.length > 0) {
    const broken = ctx.linkChecks.filter((l) => l.status === null || l.status >= 400)
    check('links.broken', 'LINKS', broken.length > 0 ? 'FAIL' : 'PASS', 'Broken links', broken.length > 0 ? `${broken.length} of ${ctx.linkChecks.length} checked links did not load (error, timeout or HTTP 4xx/5xx).` : `All ${ctx.linkChecks.length} checked links loaded.`, { checked: ctx.linkChecks.length, broken: broken.slice(0, 10).map((l) => ({ url: sanitizeLine(l.url, 200), status: l.status })) })
    if (broken.length > 0) advise('links.broken', 'LINKS', `Fix or remove ${broken.length} broken link${broken.length === 1 ? '' : 's'}`, 'Update each broken link to a working address or remove it. Broken links hurt user experience and waste crawl budget. (Only a sample of links on the audited page was checked.)', 3, 2, 'MEDIUM')
    const redirected = ctx.linkChecks.filter((l) => l.redirects > 0).length
    if (redirected > 0) check('links.redirected', 'LINKS', 'INFO', 'Links that redirect', `${redirected} of the checked links redirect to another address; linking to the final address avoids the extra hop.`)
  }

  // Inbound internal links among the crawled pages (a small sample, so low confidence).
  if (allPages.length >= 3) {
    const inbound = new Map<string, number>()
    for (const p of ctx.pages) inbound.set(stripWww(p.url), 0)
    for (const from of allPages) for (const to of from.internalLinks) {
      const key = stripWww(to)
      if (inbound.has(key) && key !== stripWww(from.url)) inbound.set(key, (inbound.get(key) ?? 0) + 1)
    }
    const weak = [...inbound.entries()].filter(([, n]) => n <= 1).map(([u]) => u)
    if (weak.length > 0 && wantAdvice) {
      out.push({ checkKey: 'links.weakInbound.fix', category: 'LINKS', label: 'RECOMMENDATION', title: 'Link to these pages from more places', detail: `${weak.length} of the ${ctx.pages.length} additional pages sampled receive at most one internal link within the sample (${weak.slice(0, 3).map((u) => sanitizeLine(u, 80)).join(', ')}). Add contextual links from related pages. Based on a small crawl sample.`, impact: 2, effort: 2, confidence: 'LOW' })
    }
  }

  // ─────────────────────────── structured data ────────────────────────
  check('schema.jsonLd', 'STRUCTURED_DATA', m.jsonLdTypes.length > 0 ? 'PASS' : 'WARN', 'Structured data (JSON-LD)', m.jsonLdTypes.length > 0 ? `Structured data found: ${m.jsonLdTypes.slice(0, 6).join(', ')}.` : 'No JSON-LD structured data was found.', { types: m.jsonLdTypes })
  if (m.jsonLdTypes.length === 0) advise('schema.jsonLd', 'STRUCTURED_DATA', 'Add structured data', 'Add JSON-LD for your Organization (and LocalBusiness or Service where relevant) so search engines can understand your business.', 3, 2, 'MEDIUM')

  // ───────────────────────────── local ────────────────────────────────
  const local = m.jsonLdTypes.some((t) => /localbusiness|store|restaurant|dentist|professionalservice|organization/i.test(t))
  check('local.schema', 'LOCAL', local ? 'PASS' : 'WARN', 'Business schema for local search', local ? 'Organization/LocalBusiness structured data is present.' : 'No Organization or LocalBusiness structured data was found.')
  check('local.phone', 'LOCAL', m.hasTel ? 'PASS' : 'WARN', 'Click-to-call phone link', m.hasTel ? 'A tel: link is present.' : 'No tel: phone link was found on the page.')
  check('local.map', 'LOCAL', m.hasMapLink ? 'PASS' : 'INFO', 'Map or directions link', m.hasMapLink ? 'A Google Maps link or embed is present.' : 'No map or directions link was found.')
  if (!local || !m.hasTel) advise('local.basics', 'LOCAL', 'Strengthen local SEO basics', 'Add LocalBusiness structured data, a click-to-call phone link and a map/directions link, and keep your name, address and phone consistent everywhere. Claim and complete your Google Business Profile.', 3, 2, 'MEDIUM')
  out.push({ checkKey: 'local.gbp', category: 'LOCAL', label: 'UNAVAILABLE', title: 'Google Business Profile status', detail: 'Whether a Google Business Profile exists, is verified, and how it performs cannot be checked: the Google Business Profile integration is not connected.' })

  // ───────────────────────── performance (PageSpeed) ──────────────────
  if (ctx.pageSpeed === 'SKIPPED') {
    out.push({ checkKey: 'perf.pagespeed', category: 'PERFORMANCE', label: 'UNAVAILABLE', title: 'Core Web Vitals', detail: 'Core Web Vitals were not requested for this audit.' })
  } else if (ctx.pageSpeed === null) {
    out.push({ checkKey: 'perf.pagespeed', category: 'PERFORMANCE', label: 'UNAVAILABLE', title: 'Core Web Vitals', detail: "Google's PageSpeed Insights did not return data for this page (the service may be unavailable, rate-limited, or unable to test it). No performance numbers are shown rather than guessing them." })
  } else {
    const ps = ctx.pageSpeed
    const grade = (value: number | null, good: number, ok: number): CheckResult => (value === null ? 'INFO' : value <= good ? 'PASS' : value <= ok ? 'WARN' : 'FAIL')
    const lab = 'Lab measurement from Google PageSpeed Insights (simulated mobile device), not real-visitor data.'
    if (ps.performanceScore !== null) check('perf.score', 'PERFORMANCE', ps.performanceScore >= 0.9 ? 'PASS' : ps.performanceScore >= 0.5 ? 'WARN' : 'FAIL', 'Lighthouse performance score (mobile)', `${Math.round(ps.performanceScore * 100)} out of 100. ${lab}`, { score: Math.round(ps.performanceScore * 100) })
    if (ps.lcpMs !== null) check('perf.lcp', 'PERFORMANCE', grade(ps.lcpMs, 2500, 4000), 'Largest Contentful Paint (lab)', `${(ps.lcpMs / 1000).toFixed(1)} s. Good is 2.5 s or less. ${lab}`, { ms: Math.round(ps.lcpMs) })
    if (ps.cls !== null) check('perf.cls', 'PERFORMANCE', grade(ps.cls, 0.1, 0.25), 'Cumulative Layout Shift (lab)', `${ps.cls.toFixed(3)}. Good is 0.1 or less. ${lab}`, { value: ps.cls })
    if (ps.tbtMs !== null) check('perf.tbt', 'PERFORMANCE', grade(ps.tbtMs, 200, 600), 'Total Blocking Time (lab)', `${Math.round(ps.tbtMs)} ms. Good is 200 ms or less; it is the lab stand-in for interactivity (INP). ${lab}`, { ms: Math.round(ps.tbtMs) })
    if (ps.field) {
      const cat = (c: string): CheckResult => (c === 'FAST' ? 'PASS' : c === 'AVERAGE' ? 'WARN' : c === 'SLOW' ? 'FAIL' : 'INFO')
      const fieldNote = 'Real-user data from the Chrome UX Report (last 28 days), as returned by Google.'
      if (ps.field.lcp) check('perf.field.lcp', 'PERFORMANCE', cat(ps.field.lcp.category), 'Largest Contentful Paint (real users)', `${(ps.field.lcp.ms / 1000).toFixed(1)} s at the 75th percentile (${ps.field.lcp.category.toLowerCase()}). ${fieldNote}`)
      if (ps.field.cls) check('perf.field.cls', 'PERFORMANCE', cat(ps.field.cls.category), 'Cumulative Layout Shift (real users)', `${ps.field.cls.value.toFixed(2)} at the 75th percentile (${ps.field.cls.category.toLowerCase()}). ${fieldNote}`)
      if (ps.field.inp) check('perf.field.inp', 'PERFORMANCE', cat(ps.field.inp.category), 'Interaction to Next Paint (real users)', `${Math.round(ps.field.inp.ms)} ms at the 75th percentile (${ps.field.inp.category.toLowerCase()}). ${fieldNote}`)
    } else {
      out.push({ checkKey: 'perf.field', category: 'PERFORMANCE', label: 'UNAVAILABLE', title: 'Real-user Core Web Vitals', detail: 'Google has no real-user (Chrome UX Report) data for this page — typically because it has too little traffic.' })
    }
    const slow = (ps.lcpMs ?? 0) > 2500 || (ps.cls ?? 0) > 0.1 || (ps.tbtMs ?? 0) > 200
    if (slow) advise('perf.core', 'PERFORMANCE', 'Improve Core Web Vitals', 'Optimize and size images, defer non-critical JavaScript, reserve space for images and embeds to avoid layout shift, and use a CDN. Re-test after each change.', 4, 4, 'MEDIUM')
  }

  // ────────────────── data we do NOT have (stated, never faked) ───────
  const unavailable = (key: string, title: string, detail: string) => out.push({ checkKey: key, category: 'DATA_SOURCES', label: 'UNAVAILABLE', title, detail })
  unavailable('data.rankings', 'Search rankings, impressions and clicks', 'Not available: requires Google Search Console, which is not connected. No ranking or click numbers are shown.')
  unavailable('data.traffic', 'Website traffic and conversions', 'Not available: requires Google Analytics 4, which is not connected.')
  unavailable('data.keywords', 'Keyword search volume and difficulty', 'Not available: requires an approved keyword/SEO data provider, which is not connected. Keyword ideas elsewhere in this workspace are suggestions without volumes.')
  unavailable('data.backlinks', 'Backlinks and domain authority', 'Not available: requires a backlink data provider, which is not connected.')
  if (ctx.kind === 'COMPETITOR') unavailable('data.competitor', 'Competitor performance', "Only this site's publicly visible page signals were checked. Its traffic, rankings and backlinks cannot be known without a data provider.")
  if (ctx.truncated) out.push({ checkKey: 'crawl.truncated', category: 'DATA_SOURCES', label: 'UNAVAILABLE', title: 'Part of the crawl was skipped', detail: 'The audit stopped early to stay within its time budget, so some pages or links were not checked.' })

  // ───────────── qualitative opportunity estimates (no numbers) ───────
  if (wantAdvice) {
    const byCategory = new Map<string, { fail: number; warn: number }>()
    for (const f of out) {
      if (f.label !== 'VERIFIED' || (f.result !== 'FAIL' && f.result !== 'WARN')) continue
      const entry = byCategory.get(f.category) ?? { fail: 0, warn: 0 }
      if (f.result === 'FAIL') entry.fail += 1
      else entry.warn += 1
      byCategory.set(f.category, entry)
    }
    for (const [category, { fail, warn }] of byCategory) {
      const level = fail >= 2 ? 'HIGH' : fail >= 1 || warn >= 3 ? 'MEDIUM' : 'LOW'
      out.push({
        checkKey: `estimate.${category.toLowerCase()}`,
        category,
        label: 'ESTIMATE',
        title: `Estimated opportunity: ${level.toLowerCase()}`,
        detail: `Qualitative estimate from ${fail} failing and ${warn} warning check${fail + warn === 1 ? '' : 's'} in this area. No traffic or ranking data is connected, so no numeric impact is estimated.`,
        impact: level === 'HIGH' ? 4 : level === 'MEDIUM' ? 3 : 2,
        confidence: 'LOW',
      })
    }
  }

  return out
}

export function summarize(findings: FindingDraft[]) {
  const labels = { VERIFIED: 0, RECOMMENDATION: 0, ESTIMATE: 0, UNAVAILABLE: 0 }
  const results = { PASS: 0, WARN: 0, FAIL: 0, INFO: 0 }
  for (const f of findings) {
    labels[f.label] += 1
    if (f.label === 'VERIFIED' && f.result) results[f.result] += 1
  }
  return { labels, results }
}
