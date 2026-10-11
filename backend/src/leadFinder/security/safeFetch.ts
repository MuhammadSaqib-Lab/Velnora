import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * A hardened fetch for URLs that ultimately come from research data (a
 * Google Places listing's `website` field), not a value this codebase
 * chose itself. Treat it the same as any other attacker-influenceable
 * URL: Places listings can be edited/suggested, so "Google said this is
 * the website" is not the same guarantee as "this URL is safe to fetch
 * from our server."
 *
 * Blocks the classic SSRF surface: non-http(s) schemes, credentials in
 * the URL, loopback/private/link-local/multicast/reserved IP ranges (by
 * resolving the hostname, not just string-matching it — a hostname can
 * resolve to a private IP even if the string itself doesn't look like
 * one), and redirects to a newly-disallowed target (each hop is
 * re-validated from scratch, redirects are never followed automatically).
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const MAX_REDIRECTS = 3
const DEFAULT_TIMEOUT_MS = 8000
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024 // 3MB — plenty for HTML, not for an abuse payload
const DEFAULT_USER_AGENT = 'VelnoraLeadFinderBot/1.0 (+https://www.velnora.com)'

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

function isDisallowedIp(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    const octets = address.split('.').map(Number)
    const [a, b] = octets
    if (a === 127) return true // loopback
    if (a === 10) return true // private
    if (a === 172 && b >= 16 && b <= 31) return true // private
    if (a === 192 && b === 168) return true // private
    if (a === 169 && b === 254) return true // link-local (incl. cloud metadata 169.254.169.254)
    if (a === 0) return true // "this network"
    if (a >= 224) return true // multicast/reserved
    return false
  }
  if (version === 6) {
    const lower = address.toLowerCase()
    if (lower === '::1') return true // loopback
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9')) return true // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 — re-check the embedded v4 address.
      return isDisallowedIp(lower.replace('::ffff:', ''))
    }
    return false
  }
  return true // couldn't parse as an IP at all — reject rather than guess
}

async function assertSafeHost(hostname: string): Promise<void> {
  if (hostname === 'localhost') throw new UnsafeUrlError('Refusing to fetch localhost')

  let addresses: string[]
  try {
    const results = await lookup(hostname, { all: true, verbatim: true })
    addresses = results.map((r) => r.address)
  } catch {
    throw new UnsafeUrlError(`Could not resolve hostname: ${hostname}`)
  }

  if (addresses.length === 0) throw new UnsafeUrlError(`Hostname resolved to no addresses: ${hostname}`)

  for (const address of addresses) {
    if (isDisallowedIp(address)) {
      throw new UnsafeUrlError(`Hostname resolves to a disallowed address: ${hostname} -> ${address}`)
    }
  }
}

function assertSafeUrlShape(url: URL): void {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(`Disallowed protocol: ${url.protocol}`)
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed')
  }
}

export interface SafeFetchResult {
  finalUrl: string
  status: number
  headers: Headers
  text: string
  durationMs: number
  /** Every URL requested before the final one, in order (empty when there was no redirect). */
  redirects: string[]
}

/**
 * Optional per-call settings. Every default equals the original behavior,
 * so existing callers (the Lead Finder) are unaffected. Limits can only be
 * tightened in practice — callers never pass larger ones.
 */
export interface SafeFetchOptions {
  method?: 'GET' | 'HEAD'
  userAgent?: string
  timeoutMs?: number
  maxBytes?: number
}

/**
 * Fetches a URL with SSRF, redirect, timeout, and response-size
 * safeguards. Returns `null` (never throws for "the site is just down")
 * on any network-level failure — callers treat a null result as an
 * honest "could not reach this website," not a fatal error.
 */
export async function safeFetchText(inputUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult | null> {
  const method = options.method ?? 'GET'
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = Math.min(options.maxBytes ?? MAX_RESPONSE_BYTES, MAX_RESPONSE_BYTES)
  const redirects: string[] = []
  let currentUrl: URL
  try {
    currentUrl = new URL(inputUrl)
  } catch {
    return null
  }

  const startedAt = Date.now()

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    try {
      assertSafeUrlShape(currentUrl)
      await assertSafeHost(currentUrl.hostname)
    } catch {
      return null
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(currentUrl, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT },
      })
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return null
      redirects.push(currentUrl.toString())
      try {
        currentUrl = new URL(location, currentUrl)
      } catch {
        return null
      }
      continue // loop re-validates the new URL from scratch before following it
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > maxBytes) {
      return null
    }

    const body = response.body
    if (!body) {
      const text = await response.text().catch(() => '')
      return { finalUrl: currentUrl.toString(), status: response.status, headers: response.headers, text, durationMs: Date.now() - startedAt, redirects }
    }

    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        if (received > maxBytes) {
          await reader.cancel().catch(() => undefined)
          return null
        }
        chunks.push(value)
      }
    } catch {
      return null
    }

    const text = Buffer.concat(chunks).toString('utf-8')
    return {
      finalUrl: currentUrl.toString(),
      status: response.status,
      headers: response.headers,
      text,
      durationMs: Date.now() - startedAt,
      redirects,
    }
  }

  return null // too many redirects
}
