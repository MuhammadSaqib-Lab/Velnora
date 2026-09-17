import * as cheerio from 'cheerio'
import { safeFetchText } from '../security/safeFetch.js'
import { sanitizeSnippet } from '../security/sanitizeSnippet.js'

/**
 * Everything here is either directly observed from the fetched HTML
 * (present/absent, counts) or a short sanitized excerpt of real page
 * text — never a fabricated score. There is deliberately no Lighthouse-
 * or PageSpeed-style number here (see "Website analysis" in
 * backend/README.md's Lead Finder section for why).
 */
export interface WebsiteAnalysis {
  fetched: boolean
  fetchError?: string
  finalUrl?: string
  statusCode?: number
  fetchDurationMs?: number
  title?: string
  metaDescription?: string
  hasViewportMeta?: boolean
  hasCanonical?: boolean
  hasStructuredData?: boolean
  h1Count?: number
  h2Count?: number
  imgTotal?: number
  imgWithAlt?: number
  scriptCount?: number
  htmlByteSize?: number
  hasContactCta?: boolean
  hasChatOrBookingWidget?: boolean
  robotsTxtFound?: boolean
  sitemapFound?: boolean
  /** A public business email voluntarily published on the site itself
   * (a mailto: link or plainly visible address) — never guessed,
   * inferred from a name, or looked up from a third party. */
  contactEmail?: string
}

const GENERIC_TRACKING_EMAIL_MARKERS = ['sentry.io', 'wixpress.com', 'example.com', 'noreply', 'no-reply']

function extractContactEmail($: cheerio.CheerioAPI): string | undefined {
  const mailtoHref = $('a[href^="mailto:"]').first().attr('href')
  const fromMailto = mailtoHref?.replace(/^mailto:/i, '').split('?')[0]?.trim()
  if (fromMailto && isPlausibleBusinessEmail(fromMailto)) return fromMailto.toLowerCase()

  const bodyText = $('body').text()
  const match = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.exec(bodyText)
  const fromText = match?.[0]
  if (fromText && isPlausibleBusinessEmail(fromText)) return fromText.toLowerCase()

  return undefined
}

function isPlausibleBusinessEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return !GENERIC_TRACKING_EMAIL_MARKERS.some((marker) => lower.includes(marker))
}

const KNOWN_CHAT_WIDGET_MARKERS = [
  'intercom',
  'drift.com',
  'tawk.to',
  'zendesk',
  'crisp.chat',
  'livechatinc',
  'messenger',
  'freshchat',
  'hubspot',
]

export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  const result = await safeFetchText(url)
  if (!result) {
    return { fetched: false, fetchError: 'The website did not respond during automated research.' }
  }

  if (result.status < 200 || result.status >= 400) {
    return {
      fetched: false,
      fetchError: `The website responded with HTTP ${result.status} during automated research.`,
      statusCode: result.status,
      finalUrl: result.finalUrl,
      fetchDurationMs: result.durationMs,
    }
  }

  const $ = cheerio.load(result.text)
  const html = $.html()
  const bodyText = $('body').text().toLowerCase()

  const images = $('img')
  const imgWithAlt = images.filter((_, el) => Boolean($(el).attr('alt')?.trim())).length

  return {
    fetched: true,
    finalUrl: result.finalUrl,
    statusCode: result.status,
    fetchDurationMs: result.durationMs,
    title: sanitizeSnippet($('title').first().text()),
    metaDescription: sanitizeSnippet($('meta[name="description"]').attr('content')),
    hasViewportMeta: $('meta[name="viewport"]').length > 0,
    hasCanonical: $('link[rel="canonical"]').length > 0,
    hasStructuredData: $('script[type="application/ld+json"]').length > 0,
    h1Count: $('h1').length,
    h2Count: $('h2').length,
    imgTotal: images.length,
    imgWithAlt,
    scriptCount: $('script').length,
    htmlByteSize: Buffer.byteLength(html, 'utf-8'),
    hasContactCta:
      $('a[href^="tel:"]').length > 0 ||
      $('a[href^="mailto:"]').length > 0 ||
      $('form').length > 0 ||
      /\b(contact us|book now|book an appointment|schedule|get a quote)\b/i.test(bodyText),
    hasChatOrBookingWidget: KNOWN_CHAT_WIDGET_MARKERS.some((marker) => html.toLowerCase().includes(marker)),
    contactEmail: extractContactEmail($),
    ...(await checkRobotsAndSitemap(result.finalUrl ?? url)),
  }
}

async function checkRobotsAndSitemap(pageUrl: string): Promise<{ robotsTxtFound: boolean; sitemapFound: boolean }> {
  let origin: string
  try {
    origin = new URL(pageUrl).origin
  } catch {
    return { robotsTxtFound: false, sitemapFound: false }
  }

  const [robots, sitemap] = await Promise.all([
    safeFetchText(`${origin}/robots.txt`),
    safeFetchText(`${origin}/sitemap.xml`),
  ])

  return {
    robotsTxtFound: Boolean(robots && robots.status >= 200 && robots.status < 300),
    sitemapFound: Boolean(sitemap && sitemap.status >= 200 && sitemap.status < 300),
  }
}
