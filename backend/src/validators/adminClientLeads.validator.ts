import { z } from 'zod'

const CLIENT_LEAD_SORTS = ['newest', 'oldest', 'updated_desc'] as const

/**
 * QualifiedLead reuses `SubmissionStatus` (see schema.prisma) and
 * `LeadIntent` — this validator deliberately doesn't invent a new status
 * vocabulary for the admin dashboard, per the project's "don't create
 * duplicate status systems" convention (see leadStatus.validator.ts for
 * the equivalent decision on the Lead Finder side).
 */
export const clientLeadListQuerySchema = z
  .object({
    status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED']).optional(),
    intent: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    /** Matches against name, email, or company. */
    search: z.string().trim().max(150).optional(),
    sort: z.enum(CLIENT_LEAD_SORTS).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export type ClientLeadListQuery = z.infer<typeof clientLeadListQuerySchema>

export const clientLeadStatusUpdateSchema = z
  .object({ status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED']) })
  .strict()

export type ClientLeadStatusUpdateInput = z.infer<typeof clientLeadStatusUpdateSchema>
