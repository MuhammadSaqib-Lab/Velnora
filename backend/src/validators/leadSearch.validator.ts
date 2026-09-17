import { z } from 'zod'

const OPPORTUNITY_TYPES = ['NO_WEBSITE', 'OLD_WEBSITE', 'POOR_MOBILE', 'WEAK_SEO', 'AI_AUTOMATION'] as const
const LEAD_PRIORITIES = ['EXCELLENT', 'STRONG', 'POTENTIAL', 'LOW'] as const
const LEAD_SORTS = ['score_desc', 'newest', 'oldest', 'priority', 'updated_desc'] as const

/**
 * `z.coerce.boolean()` is a trap for query strings: it coerces via JS's
 * `Boolean(...)`, so the literal string `"false"` — exactly what
 * `?hasWebsite=false` sends — becomes `true` (a non-empty string is
 * always truthy). This parses only the exact strings `"true"`/`"false"`,
 * rejecting anything else rather than silently misinterpreting it.
 */
const booleanQueryParam = z.enum(['true', 'false']).transform((v) => v === 'true')

export const leadSearchSchema = z
  .object({
    industry: z.string().trim().min(1, 'Industry is required').max(100),
    location: z.string().trim().min(1, 'Location is required').max(150),
    // Google Places API (New) Text Search returns at most 20 results per
    // request — see backend/src/leadFinder/providers/GooglePlacesProvider.ts.
    count: z.coerce.number().int().min(1).max(20).default(10),
    opportunityTypes: z.array(z.enum(OPPORTUNITY_TYPES)).optional(),
    minScore: z.coerce.number().int().min(0).max(100).optional(),
  })
  .strict()

export type LeadSearchInput = z.infer<typeof leadSearchSchema>

/**
 * Phase 5 (Admin Dashboard) extends this query schema with search/sort/
 * more filters — every new field is optional, and `sort` defaults to
 * `score_desc` (the previous hardcoded behavior), so every existing
 * caller of GET /api/leads keeps working unchanged.
 */
export const leadListQuerySchema = z
  .object({
    status: z
      .enum([
        'NEW',
        'RESEARCHED',
        'QUALIFIED',
        'EMAIL_DRAFTED',
        'CONTACTED',
        'REPLIED',
        'NOT_INTERESTED',
        'CONVERTED',
        'DISQUALIFIED',
      ])
      .optional(),
    minScore: z.coerce.number().int().min(0).max(100).optional(),
    maxScore: z.coerce.number().int().min(0).max(100).optional(),
    category: z.string().trim().max(100).optional(),
    location: z.string().trim().max(150).optional(),
    /** Matches against businessName, domain, email, or location. */
    search: z.string().trim().max(150).optional(),
    priority: z.enum(LEAD_PRIORITIES).optional(),
    opportunityTypes: z
      .union([z.array(z.enum(OPPORTUNITY_TYPES)), z.enum(OPPORTUNITY_TYPES)])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
    source: z.string().trim().max(100).optional(),
    hasEmail: booleanQueryParam.optional(),
    hasWebsite: booleanQueryParam.optional(),
    sort: z.enum(LEAD_SORTS).default('score_desc'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export type LeadListQuery = z.infer<typeof leadListQuerySchema>

export const createDraftSchema = z.object({ force: z.boolean().optional() }).strict()
export type CreateDraftInput = z.infer<typeof createDraftSchema>
