import type { AIToolDefinition } from '../ai/providers/types.js'
import { ACQUISITION_CATEGORIES, EFFORTS, EVIDENCE_KINDS, ITEM_STATUSES, PRIORITIES } from '../validators/marketing.validator.js'
import { CONTENT_TYPES, PLATFORMS, type ContentType, type Platform } from './platforms.js'
import { sanitizeLine, sanitizeText } from './text.js'

/**
 * Tool definitions and output normalizers for the Digital Marketing agent's
 * generations. A model answers ONLY by calling one of these tools; whatever
 * it returns is treated as untrusted input: unknown fields are ignored,
 * every enum is checked against an allowlist, text is sanitized and capped,
 * and invalid items are dropped rather than passed along.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const oneOf = <T extends string>(allowed: readonly T[], v: unknown): T | null => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null)

// ─────────────────────────────── social content ──────────────────────────────

export const socialDraftsTool: AIToolDefinition = {
  name: 'submit_social_drafts',
  description:
    'Return the requested social media drafts. Each item is a ready-to-review draft for ONE platform. Never invent statistics, clients, testimonials or results. Hashtags without the # symbol.',
  inputSchema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: [...PLATFORMS] },
            contentType: { type: 'string', enum: [...CONTENT_TYPES] },
            title: { type: 'string', description: 'Optional headline/hook (required for YouTube).' },
            body: { type: 'string', description: 'The caption, script, carousel slide text or outline.' },
            hashtags: { type: 'array', items: { type: 'string' } },
            callToAction: { type: 'string' },
            suggestedDate: { type: 'string', description: 'YYYY-MM-DD, only when a calendar month was requested.' },
            notes: { type: 'string', description: 'Short note for the reviewer (visual idea, what to verify).' },
          },
          required: ['platform', 'body'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
}

export interface GeneratedDraft {
  platform: Platform
  contentType: ContentType
  title: string | null
  body: string
  hashtags: string[]
  callToAction: string | null
  suggestedDate: Date | null
  notes: string | null
}

function cleanHashtags(value: unknown): string[] {
  const out: string[] = []
  for (const raw of asArray(value)) {
    if (typeof raw !== 'string') continue
    const tag = raw.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 60)
    // Hashtags are case-insensitive: "#SEO" and "#seo" are the same tag.
    if (tag && !out.some((existing) => existing.toLowerCase() === `#${tag}`.toLowerCase())) out.push(`#${tag}`)
    if (out.length >= 30) break
  }
  return out
}

export function normalizeSocialDrafts(
  input: unknown,
  opts: { platforms: readonly Platform[]; contentType: ContentType; maxItems: number; month?: string },
): GeneratedDraft[] | null {
  if (!isRecord(input)) return null
  const drafts: GeneratedDraft[] = []

  for (const raw of asArray(input.items)) {
    if (!isRecord(raw)) continue
    const platform = oneOf(opts.platforms, raw.platform)
    const body = sanitizeText(raw.body, 10000)
    if (!platform || !body) continue

    let suggestedDate: Date | null = null
    if (opts.month && typeof raw.suggestedDate === 'string' && raw.suggestedDate.startsWith(`${opts.month}-`)) {
      const d = new Date(`${raw.suggestedDate}T00:00:00.000Z`)
      if (!Number.isNaN(d.getTime()) && d.toISOString().startsWith(raw.suggestedDate)) suggestedDate = d
    }

    drafts.push({
      platform,
      contentType: oneOf(CONTENT_TYPES, raw.contentType) ?? opts.contentType,
      title: sanitizeLine(raw.title, 200) || null,
      body,
      hashtags: cleanHashtags(raw.hashtags),
      callToAction: sanitizeLine(raw.callToAction, 300) || null,
      suggestedDate,
      notes: sanitizeText(raw.notes, 1000) || null,
    })
    if (drafts.length >= opts.maxItems) break
  }
  return drafts.length > 0 ? drafts : null
}

// ──────────────────────────────── plans ──────────────────────────────────────

export const marketingPlanTool: AIToolDefinition = {
  name: 'submit_marketing_plan',
  description:
    'Return an actionable marketing plan. Separate what is VERIFIED (stated in the provided data) from ASSUMPTIONS and ESTIMATES. Never invent metrics, volumes, rankings or results; never guarantee outcomes.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      objective: { type: 'string' },
      audience: { type: 'string' },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          properties: { kind: { type: 'string', enum: [...EVIDENCE_KINDS] }, text: { type: 'string' } },
          required: ['kind', 'text'],
          additionalProperties: false,
        },
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: [...ACQUISITION_CATEGORIES] },
            title: { type: 'string' },
            detail: { type: 'string' },
            priority: { type: 'string', enum: [...PRIORITIES] },
            effort: { type: 'string', enum: [...EFFORTS] },
            expectedOutcome: { type: 'string', description: 'A possible outcome, phrased as an estimate — never a promise or a number you cannot source.' },
            measurement: { type: 'string', description: 'How to measure it (which metric, in which tool).' },
            resources: { type: 'string', description: 'Integrations/resources needed.' },
          },
          required: ['title', 'detail', 'priority', 'effort'],
          additionalProperties: false,
        },
      },
      kpis: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, measurement: { type: 'string' } },
          required: ['name', 'measurement'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'objective', 'items'],
    additionalProperties: false,
  },
}

export interface GeneratedPlan {
  title: string
  objective: string
  audience: string | null
  evidence: Array<{ kind: (typeof EVIDENCE_KINDS)[number]; text: string }>
  items: Array<{
    category?: (typeof ACQUISITION_CATEGORIES)[number]
    title: string
    detail: string
    priority: (typeof PRIORITIES)[number]
    effort: (typeof EFFORTS)[number]
    expectedOutcome?: string
    measurement?: string
    resources?: string
    status: (typeof ITEM_STATUSES)[number]
  }>
  kpis: Array<{ name: string; measurement: string }>
}

/** Every expected outcome is stored as an explicit estimate, whatever the model wrote. */
function asEstimate(text: string): string {
  return /^estimate\b/i.test(text) ? text : `Estimate: ${text}`
}

export function normalizePlan(input: unknown, opts: { hasVerifiedData: boolean }): GeneratedPlan | null {
  if (!isRecord(input)) return null
  const title = sanitizeLine(input.title, 200)
  const objective = sanitizeText(input.objective, 600)
  if (title.length < 3 || objective.length < 3) return null

  const evidence: GeneratedPlan['evidence'] = []
  for (const raw of asArray(input.evidence)) {
    if (!isRecord(raw)) continue
    const text = sanitizeText(raw.text, 600)
    let kind = oneOf(EVIDENCE_KINDS, raw.kind)
    if (!text || !kind) continue
    // Nothing verifiable was supplied, so nothing may be presented as verified.
    if (kind === 'VERIFIED' && !opts.hasVerifiedData) kind = 'ASSUMPTION'
    evidence.push({ kind, text })
    if (evidence.length >= 20) break
  }

  const items: GeneratedPlan['items'] = []
  for (const raw of asArray(input.items)) {
    if (!isRecord(raw)) continue
    const itemTitle = sanitizeLine(raw.title, 200)
    const detail = sanitizeText(raw.detail, 2000)
    if (itemTitle.length < 3 || !detail) continue
    const outcome = sanitizeText(raw.expectedOutcome, 560)
    items.push({
      category: oneOf(ACQUISITION_CATEGORIES, raw.category) ?? undefined,
      title: itemTitle,
      detail,
      priority: oneOf(PRIORITIES, raw.priority) ?? 'MEDIUM',
      effort: oneOf(EFFORTS, raw.effort) ?? 'MEDIUM',
      expectedOutcome: outcome ? asEstimate(outcome) : undefined,
      measurement: sanitizeText(raw.measurement, 400) || undefined,
      resources: sanitizeText(raw.resources, 400) || undefined,
      status: 'TODO',
    })
    if (items.length >= 20) break
  }
  if (items.length === 0) return null

  const kpis: GeneratedPlan['kpis'] = []
  for (const raw of asArray(input.kpis)) {
    if (!isRecord(raw)) continue
    const name = sanitizeLine(raw.name, 120)
    const measurement = sanitizeText(raw.measurement, 300)
    if (name && measurement) kpis.push({ name, measurement })
    if (kpis.length >= 12) break
  }

  return { title, objective, audience: sanitizeText(input.audience, 600) || null, evidence, items, kpis }
}
