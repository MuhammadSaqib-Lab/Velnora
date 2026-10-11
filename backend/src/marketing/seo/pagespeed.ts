import { env } from '../../config/env.js'
import type { PageSpeedResult } from './checks.js'

/**
 * Core Web Vitals via Google's PageSpeed Insights API — the only external
 * data source this workspace uses. The host is fixed (not derived from user
 * input), Google fetches the audited page itself, and the optional API key
 * stays on the server (it is never logged, returned or stored). Returns
 * null on any failure so callers report the data as unavailable rather
 * than inventing numbers.
 */
const ENDPOINT = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed'
const TIMEOUT_MS = 25_000

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function fieldMetric(metrics: Record<string, unknown>, key: string): { value: number; category: string } | null {
  const metric = metrics[key]
  if (!isRecord(metric)) return null
  const value = num(metric.percentile)
  const category = typeof metric.category === 'string' ? metric.category : null
  return value !== null && category ? { value, category } : null
}

export function parsePageSpeed(data: unknown): PageSpeedResult | null {
  if (!isRecord(data) || !isRecord(data.lighthouseResult)) return null
  const lighthouse = data.lighthouseResult
  const audits = isRecord(lighthouse.audits) ? lighthouse.audits : {}
  const auditValue = (id: string): number | null => (isRecord(audits[id]) ? num((audits[id] as Record<string, unknown>).numericValue) : null)
  const categories = isRecord(lighthouse.categories) ? lighthouse.categories : {}
  const perf = isRecord(categories.performance) ? num((categories.performance as Record<string, unknown>).score) : null

  const result: PageSpeedResult = {
    performanceScore: perf,
    lcpMs: auditValue('largest-contentful-paint'),
    cls: auditValue('cumulative-layout-shift'),
    tbtMs: auditValue('total-blocking-time'),
    fcpMs: auditValue('first-contentful-paint'),
    speedIndexMs: auditValue('speed-index'),
    field: null,
  }
  if (result.performanceScore === null && result.lcpMs === null && result.cls === null && result.tbtMs === null) return null

  const experience = isRecord(data.loadingExperience) ? data.loadingExperience : null
  const metrics = experience && isRecord(experience.metrics) ? experience.metrics : null
  if (metrics) {
    const lcp = fieldMetric(metrics, 'LARGEST_CONTENTFUL_PAINT_MS')
    const cls = fieldMetric(metrics, 'CUMULATIVE_LAYOUT_SHIFT_SCORE')
    const inp = fieldMetric(metrics, 'INTERACTION_TO_NEXT_PAINT')
    if (lcp || cls || inp) {
      result.field = {
        ...(lcp ? { lcp: { ms: lcp.value, category: lcp.category } } : {}),
        // CrUX reports CLS ×100 as the percentile.
        ...(cls ? { cls: { value: cls.value / 100, category: cls.category } } : {}),
        ...(inp ? { inp: { ms: inp.value, category: inp.category } } : {}),
      }
    }
  }
  return result
}

export async function fetchPageSpeed(url: string): Promise<PageSpeedResult | null> {
  const endpoint = new URL(ENDPOINT)
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('strategy', 'mobile')
  endpoint.searchParams.set('category', 'performance')
  if (env.GOOGLE_PAGESPEED_API_KEY) endpoint.searchParams.set('key', env.GOOGLE_PAGESPEED_API_KEY)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, { signal: controller.signal })
    if (!response.ok) return null
    return parsePageSpeed(await response.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
