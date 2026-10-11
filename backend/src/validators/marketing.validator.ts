import { z } from 'zod'
import { CONTENT_TYPES, PLATFORMS } from '../marketing/platforms.js'
import { optionalPlainText, plainText } from '../marketing/text.js'

/**
 * Request validation for every Digital Marketing endpoint. All bodies are
 * `.strict()`: ids, statuses set by the server, `createdBy`/`approvedBy`
 * (taken from the admin session), and anything else unexpected are a 400
 * rather than silently ignored.
 */

// ───────────────────────────────── shared pieces ─────────────────────────────

export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
export const EFFORTS = ['LOW', 'MEDIUM', 'HIGH'] as const
export const ITEM_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const
export const EVIDENCE_KINDS = ['VERIFIED', 'ASSUMPTION', 'ESTIMATE'] as const
export const STRATEGY_KINDS = ['STRATEGY', 'ACQUISITION', 'SEO_PLAN'] as const
export const STRATEGY_STATUSES = ['DRAFT', 'APPROVED', 'ARCHIVED'] as const
export const CONTENT_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'] as const
export const CAMPAIGN_STATUSES = ['DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const
export const AUDIT_KINDS = ['OWN', 'CLIENT', 'COMPETITOR'] as const
export const ACQUISITION_CATEGORIES = ['NICHE', 'CAMPAIGN', 'LANDING_PAGE', 'LEAD_MAGNET', 'AUDIT_OFFER', 'FORM_IMPROVEMENT', 'CTA'] as const

const id = z.string().trim().min(1).max(64)

/** Calendar date as YYYY-MM-DD → a Date at 00:00 UTC (a real date, not 2026-02-31). */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => {
    const d = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value)
  }, 'Enter a real calendar date')
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM')

// ───────────────────────────────── SEO ───────────────────────────────────────

const MAX_URL_LENGTH = 2000

/**
 * Syntax-level URL checks (fast, no network). The real SSRF defense is
 * safeFetchText — it resolves the hostname and refuses private, loopback and
 * link-local addresses at every redirect hop — this just rejects obviously
 * unsuitable input early with a helpful message.
 */
export function normalizeAuditUrl(input: string): { ok: true; url: string; domain: string } | { ok: false; message: string } {
  const raw = input.trim()
  if (!raw || raw.length > MAX_URL_LENGTH) return { ok: false, message: 'Enter a website address like https://example.com' }
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, message: 'Enter a valid website address like https://example.com' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, message: 'Only http:// and https:// addresses can be audited' }
  if (url.username || url.password) return { ok: false, message: 'Addresses with a username or password are not allowed' }

  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host.includes('.') || host === 'localhost' || /\.(?:localhost|local|internal|lan|home|corp|test|invalid|example)$/.test(host)) {
    return { ok: false, message: 'That address is not a public website, so it cannot be audited' }
  }
  // IP literals (v4, or anything with a colon / brackets for v6) are never audited by name.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) {
    return { ok: false, message: 'Enter a website domain name, not an IP address' }
  }
  if (url.port && !['80', '443'].includes(url.port)) return { ok: false, message: 'Only the standard web ports (80/443) can be audited' }

  url.hash = ''
  return { ok: true, url: url.toString(), domain: host.replace(/^www\./, '') }
}

export const seoAuditCreateSchema = z
  .object({
    url: z
      .string({ required_error: 'Enter a website address' })
      .max(MAX_URL_LENGTH)
      .superRefine((value, ctx) => {
        const result = normalizeAuditUrl(value)
        if (!result.ok) ctx.addIssue({ code: 'custom', message: result.message })
      }),
    kind: z.enum(AUDIT_KINDS).default('OWN'),
    includePageSpeed: z.boolean().default(true),
  })
  .strict()
export type SeoAuditCreateInput = z.infer<typeof seoAuditCreateSchema>

export const seoPlanSchema = z
  .object({
    auditId: id.optional(),
    niche: optionalPlainText('Niche', 200),
    location: optionalPlainText('Location', 200),
    focus: z.enum(['GENERAL', 'LOCAL', 'CONTENT']).default('GENERAL'),
    notes: optionalPlainText('Notes', 1000),
  })
  .strict()
export type SeoPlanInput = z.infer<typeof seoPlanSchema>

export const seoAuditListQuerySchema = z
  .object({
    domain: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

export const seoCompareQuerySchema = z.object({ base: id, other: id }).strict()
export const exportQuerySchema = z.object({ format: z.enum(['md', 'json']).default('md') }).strict()

// ───────────────────────────────── social ────────────────────────────────────

export const socialGenerateSchema = z
  .object({
    platforms: z.array(z.enum(PLATFORMS)).min(1).max(PLATFORMS.length),
    contentType: z.enum(CONTENT_TYPES).default('POST'),
    objective: plainText('Objective', 3, 300),
    audience: plainText('Audience', 3, 300),
    topic: optionalPlainText('Topic', 400),
    callToAction: optionalPlainText('Call to action', 200),
    /** Facts the administrator vouches for. Required for case studies, and the ONLY source of case-study facts. */
    verifiedFacts: optionalPlainText('Verified facts', 3000),
    countPerPlatform: z.number().int().min(1).max(5).default(2),
    campaignId: id.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.contentType === 'CASE_STUDY' && (data.verifiedFacts?.length ?? 0) < 50) {
      ctx.addIssue({
        code: 'custom',
        path: ['verifiedFacts'],
        message: 'A case study can only use facts you provide — add the verified details (at least 50 characters).',
      })
    }
    if (data.platforms.length * data.countPerPlatform > 12) {
      ctx.addIssue({ code: 'custom', path: ['countPerPlatform'], message: 'Generate at most 12 drafts at a time' })
    }
  })
export type SocialGenerateInput = z.infer<typeof socialGenerateSchema>

export const socialCalendarSchema = z
  .object({
    month,
    platforms: z.array(z.enum(PLATFORMS)).min(1).max(PLATFORMS.length),
    postsPerWeek: z.number().int().min(1).max(5).default(2),
    objective: plainText('Objective', 3, 300),
    audience: plainText('Audience', 3, 300),
    themes: optionalPlainText('Themes', 600),
  })
  .strict()
export type SocialCalendarInput = z.infer<typeof socialCalendarSchema>

export const socialRepurposeSchema = z
  .object({ sourceDraftId: id, platforms: z.array(z.enum(PLATFORMS)).min(1).max(PLATFORMS.length) })
  .strict()
export type SocialRepurposeInput = z.infer<typeof socialRepurposeSchema>

export const socialRegenerateSchema = z.object({ instruction: optionalPlainText('Instruction', 400) }).strict()
export type SocialRegenerateInput = z.infer<typeof socialRegenerateSchema>

const hashtag = z
  .string()
  .trim()
  .regex(/^#?[\p{L}\p{N}_]{1,60}$/u, 'Hashtags may contain letters, numbers and underscores only')
  .transform((value) => (value.startsWith('#') ? value : `#${value}`))

export const socialDraftCreateSchema = z
  .object({
    platform: z.enum(PLATFORMS),
    contentType: z.enum(CONTENT_TYPES).default('POST'),
    objective: optionalPlainText('Objective', 300),
    audience: optionalPlainText('Audience', 300),
    title: optionalPlainText('Title', 200),
    body: plainText('Body', 1, 10000),
    hashtags: z.array(hashtag).max(30).default([]),
    callToAction: optionalPlainText('Call to action', 300),
    notes: optionalPlainText('Notes', 1000),
    plannedFor: dateOnly.optional(),
    campaignId: id.optional(),
  })
  .strict()
export type SocialDraftCreateInput = z.infer<typeof socialDraftCreateSchema>

export const socialDraftUpdateSchema = z
  .object({
    title: optionalPlainText('Title', 200).nullable(),
    body: plainText('Body', 1, 10000).optional(),
    hashtags: z.array(hashtag).max(30).optional(),
    callToAction: optionalPlainText('Call to action', 300).nullable(),
    notes: optionalPlainText('Notes', 1000).nullable(),
    objective: optionalPlainText('Objective', 300).nullable(),
    audience: optionalPlainText('Audience', 300).nullable(),
    plannedFor: dateOnly.nullable().optional(),
    campaignId: id.nullable().optional(),
  })
  .strict()
export type SocialDraftUpdateInput = z.infer<typeof socialDraftUpdateSchema>

export const socialDuplicateSchema = z.object({ platform: z.enum(PLATFORMS).optional() }).strict()
export type SocialDuplicateInput = z.infer<typeof socialDuplicateSchema>

export const contentStatusSchema = z.object({ status: z.enum(CONTENT_STATUSES) }).strict()

export const socialListQuerySchema = z
  .object({
    status: z.enum(CONTENT_STATUSES).optional(),
    platform: z.enum(PLATFORMS).optional(),
    campaignId: id.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

export const calendarQuerySchema = z.object({ month }).strict()

// ─────────────────────────────── strategy ────────────────────────────────────

export const strategyItemSchema = z
  .object({
    category: z.enum(ACQUISITION_CATEGORIES).optional(),
    title: plainText('Title', 3, 200),
    detail: plainText('Detail', 1, 2000),
    priority: z.enum(PRIORITIES).default('MEDIUM'),
    effort: z.enum(EFFORTS).default('MEDIUM'),
    expectedOutcome: optionalPlainText('Expected outcome', 600),
    measurement: optionalPlainText('Measurement', 400),
    resources: optionalPlainText('Resources', 400),
    status: z.enum(ITEM_STATUSES).default('TODO'),
  })
  .strict()
export type StrategyItem = z.infer<typeof strategyItemSchema>

export const evidenceSchema = z.object({ kind: z.enum(EVIDENCE_KINDS), text: plainText('Evidence', 1, 600) }).strict()
export const kpiSchema = z.object({ name: plainText('KPI name', 1, 120), measurement: plainText('KPI measurement', 1, 300) }).strict()

export const strategyCreateSchema = z
  .object({
    kind: z.enum(STRATEGY_KINDS).default('STRATEGY'),
    title: plainText('Title', 3, 200),
    objective: plainText('Objective', 3, 600),
    audience: optionalPlainText('Audience', 600),
    evidence: z.array(evidenceSchema).max(20).default([]),
    items: z.array(strategyItemSchema).max(30).default([]),
    kpis: z.array(kpiSchema).max(12).default([]),
  })
  .strict()
export type StrategyCreateInput = z.infer<typeof strategyCreateSchema>

export const strategyUpdateSchema = z
  .object({
    title: plainText('Title', 3, 200).optional(),
    objective: plainText('Objective', 3, 600).optional(),
    audience: optionalPlainText('Audience', 600).nullable(),
    evidence: z.array(evidenceSchema).max(20).optional(),
    items: z.array(strategyItemSchema).max(30).optional(),
    kpis: z.array(kpiSchema).max(12).optional(),
  })
  .strict()
export type StrategyUpdateInput = z.infer<typeof strategyUpdateSchema>

export const strategyStatusSchema = z.object({ status: z.enum(STRATEGY_STATUSES) }).strict()
export const strategyItemStatusSchema = z.object({ status: z.enum(ITEM_STATUSES) }).strict()

export const strategyGenerateSchema = z
  .object({
    goal: plainText('Goal', 3, 600),
    audience: optionalPlainText('Audience', 400),
    market: optionalPlainText('Market', 300),
    budgetNote: optionalPlainText('Budget note', 300),
    horizon: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY']).default('MONTHLY'),
    notes: optionalPlainText('Notes', 1000),
  })
  .strict()
export type StrategyGenerateInput = z.infer<typeof strategyGenerateSchema>

export const acquisitionGenerateSchema = z
  .object({
    categories: z.array(z.enum(ACQUISITION_CATEGORIES)).min(1).max(ACQUISITION_CATEGORIES.length),
    service: optionalPlainText('Service', 200),
    niche: optionalPlainText('Niche', 200),
    location: optionalPlainText('Location', 200),
    notes: optionalPlainText('Notes', 1000),
  })
  .strict()
export type AcquisitionGenerateInput = z.infer<typeof acquisitionGenerateSchema>

export const strategyListQuerySchema = z
  .object({
    kind: z.enum(STRATEGY_KINDS).optional(),
    status: z.enum(STRATEGY_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

// ─────────────────────────────── campaigns ───────────────────────────────────

const activitySchema = z
  .object({
    title: plainText('Activity', 1, 200),
    dueDate: dateOnly.optional(),
    done: z.boolean().default(false),
  })
  .strict()

const campaignFields = {
  name: plainText('Name', 2, 160),
  objective: plainText('Objective', 3, 600),
  audience: optionalPlainText('Audience', 400),
  market: optionalPlainText('Market', 300),
  service: optionalPlainText('Service', 200),
  channel: optionalPlainText('Channel', 120),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  budgetAmount: z.number().int().min(0).max(100_000_000).optional(),
  budgetCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code').optional(),
  activities: z.array(activitySchema).max(30).default([]),
  successMetrics: optionalPlainText('Success metrics', 800),
  status: z.enum(CAMPAIGN_STATUSES).default('DRAFT'),
  notes: optionalPlainText('Notes', 2000),
  results: optionalPlainText('Results', 2000),
}

export const campaignCreateSchema = z
  .object(campaignFields)
  .strict()
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The end date must be on or after the start date' })
    }
  })
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>

export const campaignUpdateSchema = z
  .object({
    name: campaignFields.name.optional(),
    objective: campaignFields.objective.optional(),
    audience: optionalPlainText('Audience', 400).nullable(),
    market: optionalPlainText('Market', 300).nullable(),
    service: optionalPlainText('Service', 200).nullable(),
    channel: optionalPlainText('Channel', 120).nullable(),
    startDate: dateOnly.nullable().optional(),
    endDate: dateOnly.nullable().optional(),
    budgetAmount: z.number().int().min(0).max(100_000_000).nullable().optional(),
    budgetCurrency: campaignFields.budgetCurrency.nullable(),
    activities: z.array(activitySchema).max(30).optional(),
    successMetrics: optionalPlainText('Success metrics', 800).nullable(),
    status: z.enum(CAMPAIGN_STATUSES).optional(),
    notes: optionalPlainText('Notes', 2000).nullable(),
    results: optionalPlainText('Results', 2000).nullable(),
  })
  .strict()
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>

export const campaignListQuerySchema = z
  .object({
    status: z.enum(CAMPAIGN_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

// ───────────────────────────────── tasks ─────────────────────────────────────

export const TASK_TYPES = ['SEO_AUDIT', 'SEO_PLAN', 'SOCIAL_GENERATE', 'SOCIAL_CALENDAR', 'SOCIAL_REPURPOSE', 'SOCIAL_REGENERATE', 'STRATEGY', 'ACQUISITION'] as const
export type TaskType = (typeof TASK_TYPES)[number]

export const taskListQuerySchema = z
  .object({
    status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
    type: z.enum(TASK_TYPES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

/** Optional client-chosen key so a double-click / retry-on-timeout can't run a task twice. */
export const idempotencyKeySchema = z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_.:-]+$/)
