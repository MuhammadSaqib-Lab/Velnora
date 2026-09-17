import { z } from 'zod'

/**
 * Deliberately excludes NEW, RESEARCHED, and EMAIL_DRAFTED — those are
 * set only by the pipeline itself (a fresh search, a re-analysis, and a
 * successful Gmail draft, respectively). This endpoint is for the human
 * reviewing a lead to record their own decision, not to rewind
 * pipeline-managed state.
 */
export const leadStatusUpdateSchema = z
  .object({
    status: z.enum(['QUALIFIED', 'CONTACTED', 'REPLIED', 'NOT_INTERESTED', 'CONVERTED', 'DISQUALIFIED']),
  })
  .strict()

export type LeadStatusUpdateInput = z.infer<typeof leadStatusUpdateSchema>
