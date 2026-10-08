import { z } from 'zod'
import { leadSearchSchema } from '../../validators/leadSearch.validator.js'
import type { OpportunityKey } from '../opportunities/detectOpportunities.js'

/**
 * The ONLY thing the natural-language parser is allowed to produce: a
 * strictly validated, allowlisted description of a lead search. Nothing
 * here can express an action (no send, no permission, no URL, no config) —
 * so whatever the administrator's text says, or however a model is
 * manipulated, the result is just "which businesses to look for". The
 * existing Lead Finder pipeline then executes it exactly like a manual
 * search, under the same limits.
 */

export const OPPORTUNITY_TYPES = ['NO_WEBSITE', 'OLD_WEBSITE', 'POOR_MOBILE', 'WEAK_SEO', 'AI_AUTOMATION'] as const
export const MIN_PRIORITIES = ['EXCELLENT', 'STRONG', 'POTENTIAL'] as const
export const SORT_OPTIONS = ['OPPORTUNITY_SCORE', 'NEWEST'] as const

/** Google Places returns at most 20 businesses per request (see GooglePlacesProvider). */
export const MAX_LEADS_PER_SEARCH = 20
/** Matches leadSearchSchema's `count` default — the existing safe default. */
export const DEFAULT_LEADS_PER_SEARCH = 10
/** Sanity bound on what an administrator may *ask for*; execution is always clamped to MAX_LEADS_PER_SEARCH. */
const MAX_REQUESTED_LIMIT = 1000

/** Same scale as scoreLead(): EXCELLENT ≥ 90, STRONG ≥ 75, POTENTIAL ≥ 60. */
const MIN_SCORE_FOR_PRIORITY: Record<(typeof MIN_PRIORITIES)[number], number> = {
  EXCELLENT: 90,
  STRONG: 75,
  POTENTIAL: 60,
}

export const EXAMPLE_REQUEST = 'Find 20 restaurants in Abbottabad with no website.'

// ─────────────────────────── sanitizing free text ────────────────────────────

const MAX_PHRASE_LENGTH = 80
/** Letters (any language), digits, spaces and a few punctuation marks real place/business names use. */
const SAFE_PHRASE = /^[\p{L}\p{N}][\p{L}\p{N} \-'’.&,()/+]*$/u

/**
 * Free-text criteria (a place, a business type) end up as a Places search
 * query, so they are reduced to a short, plain phrase. Anything with URL,
 * markup, brace or other unusual characters is dropped (null) rather than
 * "cleaned" — a legitimate location never needs them.
 */
export function cleanPhrase(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const collapsed = value.normalize('NFKC').replace(/\s+/g, ' ').trim()
  if (!collapsed || collapsed.length > MAX_PHRASE_LENGTH) return null
  if (!SAFE_PHRASE.test(collapsed)) return null
  return collapsed
}

const GENERIC_NOUNS = new Set(['business', 'businesses', 'company', 'companies', 'lead', 'leads', 'shop', 'shops', 'store', 'stores', 'place', 'places', 'organization', 'organizations', 'organisation', 'organisations'])
/** Words that describe a request, not a kind of business ("small businesses" is just "businesses"). */
const FILLER_ADJECTIVES = new Set(['small', 'local', 'good', 'great', 'best', 'top', 'new', 'big', 'large', 'medium', 'nearby', 'some', 'all', 'the', 'any'])

function singularize(word: string): string {
  if (word.length <= 3) return word
  if (/ies$/.test(word)) return `${word.slice(0, -3)}y`
  if (/(sses|shes|ches|xes|zes)$/.test(word)) return word.slice(0, -2)
  if (/s$/.test(word) && !/(ss|us|is)$/.test(word)) return word.slice(0, -1)
  return word
}

/**
 * "Restaurants" → "restaurant", "Law Firms" → "law firm" (final word only).
 * A request that names no real kind of business ("businesses", "small
 * businesses", "leads") normalizes to null — meaning "any type" — rather
 * than becoming a meaningless search term.
 */
export function normalizeBusinessType(value: unknown): string | null {
  const cleaned = cleanPhrase(value)
  if (!cleaned) return null
  const words = cleaned.toLowerCase().split(' ').filter((w) => !FILLER_ADJECTIVES.has(w))
  if (words.length === 0) return null
  if (words.length === 1 && GENERIC_NOUNS.has(words[0]!)) return null
  words[words.length - 1] = singularize(words[words.length - 1]!)
  const result = words.join(' ')
  return GENERIC_NOUNS.has(result) ? null : result
}

// ───────────────────────────── the criteria object ───────────────────────────

const phrase = z.preprocess((v) => cleanPhrase(v), z.string().nullable()).nullable().default(null)

export const leadSearchCriteriaSchema = z
  .object({
    location: z
      .object({ area: phrase, city: phrase, region: phrase, country: phrase })
      .strict()
      .default({ area: null, city: null, region: null, country: null }),
    businessType: z.preprocess((v) => normalizeBusinessType(v), z.string().nullable()).nullable().default(null),
    industry: phrase,
    /** What the administrator asked for. Clamped to MAX_LEADS_PER_SEARCH at execution (see planSearch). */
    limit: z.number().int().min(1).max(MAX_REQUESTED_LIMIT).nullable().default(null),
    opportunityTypes: z.array(z.enum(OPPORTUNITY_TYPES)).max(OPPORTUNITY_TYPES.length).default([]),
    requirements: z
      .object({ emailRequired: z.boolean().default(false), websiteRequired: z.boolean().default(false) })
      .strict()
      .default({ emailRequired: false, websiteRequired: false }),
    /** Minimum priority tier, only when explicitly requested ("high priority", "excellent leads"). */
    minPriority: z.enum(MIN_PRIORITIES).nullable().default(null),
    sortBy: z.enum(SORT_OPTIONS).default('OPPORTUNITY_SCORE'),
    /** "…and prioritize those with no website": ranks them first without excluding the rest. */
    prioritizeOpportunity: z.enum(OPPORTUNITY_TYPES).nullable().default(null),
  })
  .strict()

export type LeadSearchCriteria = z.infer<typeof leadSearchCriteriaSchema>

/**
 * Turns anything a parser produced (a model's tool input, the rule
 * parser's draft) into validated criteria, or null if it can't be made to
 * fit the schema. Unknown keys are discarded first so a model that adds
 * extras (an "action", a "sendEmail") is simply ignored — the strict
 * schema would otherwise reject the whole thing.
 */
export function normalizeCriteria(raw: unknown): LeadSearchCriteria | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  const loc = typeof input.location === 'object' && input.location !== null ? (input.location as Record<string, unknown>) : input

  const limitRaw = input.limit
  const limit = typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : null

  const types = Array.isArray(input.opportunityTypes)
    ? [...new Set(input.opportunityTypes.filter((t): t is (typeof OPPORTUNITY_TYPES)[number] => (OPPORTUNITY_TYPES as readonly unknown[]).includes(t)))]
    : []

  const req = typeof input.requirements === 'object' && input.requirements !== null ? (input.requirements as Record<string, unknown>) : input
  const businessType = normalizeBusinessType(input.businessType) ?? normalizeBusinessType(input.industry)

  const candidate = {
    location: { area: loc.area, city: loc.city, region: loc.region, country: loc.country },
    businessType,
    industry: input.industry,
    limit: limit !== null && limit >= 1 ? Math.min(limit, MAX_REQUESTED_LIMIT) : null,
    opportunityTypes: types,
    requirements: { emailRequired: req.emailRequired === true, websiteRequired: req.websiteRequired === true },
    minPriority: (MIN_PRIORITIES as readonly unknown[]).includes(input.minPriority) ? input.minPriority : null,
    sortBy: (SORT_OPTIONS as readonly unknown[]).includes(input.sortBy) ? input.sortBy : 'OPPORTUNITY_SCORE',
    prioritizeOpportunity: (OPPORTUNITY_TYPES as readonly unknown[]).includes(input.prioritizeOpportunity) ? input.prioritizeOpportunity : null,
  }

  const parsed = leadSearchCriteriaSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function hasLocation(criteria: LeadSearchCriteria): boolean {
  const l = criteria.location
  return Boolean(l.area || l.city || l.region || l.country)
}

/** "Blue Area, Islamabad, Pakistan" — most specific first, the form the Places text query expects. */
export function locationText(criteria: LeadSearchCriteria): string {
  const l = criteria.location
  return [l.area, l.city, l.region, l.country].filter((part): part is string => Boolean(part)).join(', ')
}

// ───────────────────────── merging the UI's explicit filters ─────────────────

export interface ExplicitFilters {
  hasEmail?: boolean
  opportunityTypes?: Array<(typeof OPPORTUNITY_TYPES)[number]>
  minPriority?: (typeof MIN_PRIORITIES)[number]
  sortBy?: (typeof SORT_OPTIONS)[number]
}

const PRIORITY_RANK: Record<(typeof MIN_PRIORITIES)[number], number> = { POTENTIAL: 1, STRONG: 2, EXCELLENT: 3 }

/**
 * How the command box and the filter controls combine — fixed and simple:
 *  - "Has email" can only ADD the email requirement;
 *  - selected opportunity chips are ADDED to the request's opportunity
 *    types (a lead qualifies if it has any of them);
 *  - a minimum priority keeps whichever of the two is stricter;
 *  - an explicitly chosen sort order wins.
 * No filter can loosen what the written request asked for.
 */
export function mergeFilters(criteria: LeadSearchCriteria, filters: ExplicitFilters | undefined): LeadSearchCriteria {
  if (!filters) return criteria
  const types = [...new Set([...criteria.opportunityTypes, ...(filters.opportunityTypes ?? [])])]
  const stricter =
    filters.minPriority && (!criteria.minPriority || PRIORITY_RANK[filters.minPriority] > PRIORITY_RANK[criteria.minPriority])
      ? filters.minPriority
      : criteria.minPriority
  return {
    ...criteria,
    opportunityTypes: types,
    requirements: { ...criteria.requirements, emailRequired: criteria.requirements.emailRequired || filters.hasEmail === true },
    minPriority: stricter,
    sortBy: filters.sortBy ?? criteria.sortBy,
  }
}

// ─────────────────────── planning: criteria → pipeline parameters ────────────

export interface PipelineParams {
  industry: string
  location: string
  count: number
  opportunityTypes?: OpportunityKey[]
  minScore?: number
  requireEmail?: boolean
  requireWebsite?: boolean
}

export type PlanResult =
  | { ok: true; params: PipelineParams; effectiveLimit: number; warnings: string[] }
  | { ok: false; message: string }

export const CANNOT_DETERMINE_MESSAGE = `I couldn't determine what type of businesses you want. Try: '${EXAMPLE_REQUEST}'`

/**
 * The last gate before the existing pipeline runs. Decides, from the
 * validated criteria alone, whether the search is well-defined — asking
 * for clarification instead of inventing missing criteria — and applies
 * the server-side limits. The final parameter object is also passed
 * through the SAME schema the manual search API uses (leadSearchSchema),
 * so an AI-built search can never exceed what an administrator could
 * submit by hand.
 */
export function planSearch(criteria: LeadSearchCriteria): PlanResult {
  const location = locationText(criteria)
  const type = criteria.businessType ?? criteria.industry

  if (!location && !type) return { ok: false, message: CANNOT_DETERMINE_MESSAGE }
  if (!location) {
    return {
      ok: false,
      message: `Which city or area should I search in? For example: '${EXAMPLE_REQUEST}'`,
    }
  }

  const types = criteria.opportunityTypes
  if (criteria.requirements.websiteRequired && types.includes('NO_WEBSITE') && types.length === 1) {
    return {
      ok: false,
      message:
        'A business can’t both have and lack a website. Tell me whether you want businesses with no website, or businesses that have one (for example, with an old website).',
    }
  }
  if (criteria.requirements.emailRequired && types.length > 0 && types.every((t) => t === 'NO_WEBSITE')) {
    return {
      ok: false,
      message:
        'Businesses without a website have no email address I can find — emails are collected from a business’s own website — so this search would return nothing. Remove the email requirement, or ask for businesses that have a website (for example, with an old website or weak SEO).',
    }
  }

  const warnings: string[] = []
  const requested = criteria.limit ?? DEFAULT_LEADS_PER_SEARCH
  const effectiveLimit = Math.min(Math.max(requested, 1), MAX_LEADS_PER_SEARCH)
  if (criteria.limit !== null && criteria.limit > MAX_LEADS_PER_SEARCH) {
    warnings.push(`A search returns at most ${MAX_LEADS_PER_SEARCH} businesses, so I searched for ${MAX_LEADS_PER_SEARCH} instead of ${criteria.limit}.`)
  }

  const params: PipelineParams = {
    industry: type ?? 'businesses',
    location,
    count: effectiveLimit,
    ...(types.length > 0 ? { opportunityTypes: [...types] } : {}),
    ...(criteria.minPriority ? { minScore: MIN_SCORE_FOR_PRIORITY[criteria.minPriority] } : {}),
    ...(criteria.requirements.emailRequired ? { requireEmail: true } : {}),
    ...(criteria.requirements.websiteRequired ? { requireWebsite: true } : {}),
  }

  // Same validation as POST /api/leads/search.
  const checked = leadSearchSchema.safeParse({
    industry: params.industry,
    location: params.location,
    count: params.count,
    opportunityTypes: params.opportunityTypes,
    minScore: params.minScore,
  })
  if (!checked.success) return { ok: false, message: CANNOT_DETERMINE_MESSAGE }

  return { ok: true, params, effectiveLimit, warnings }
}

/** A one-line, human-readable echo of what was understood (shown to the admin). */
export function describeCriteria(criteria: LeadSearchCriteria): string {
  const parts: string[] = [criteria.businessType ?? criteria.industry ?? 'any business type']
  const where = locationText(criteria)
  if (where) parts.push(`in ${where}`)
  if (criteria.opportunityTypes.length > 0) parts.push(`with ${criteria.opportunityTypes.map((t) => t.replace(/_/g, ' ').toLowerCase()).join(' or ')}`)
  if (criteria.requirements.emailRequired) parts.push('that have an email')
  return parts.join(' ')
}
