import { z } from 'zod'
import { MIN_PRIORITIES, OPPORTUNITY_TYPES, SORT_OPTIONS } from '../leadFinder/nlSearch/criteria.js'

// Control characters other than tab / newline / carriage return.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

/**
 * The browser sends exactly two things: the administrator's sentence and
 * the allowed filter controls. No criteria, no provider parameters, no
 * limits — all of that is derived and validated server-side. `.strict()`
 * rejects anything else (e.g. a client trying to pass `count: 500` or
 * `industry` directly).
 */
export const nlLeadSearchSchema = z
  .object({
    naturalLanguageQuery: z
      .string({ required_error: 'Tell Lead Finder what you need' })
      .trim()
      .min(3, 'Tell Lead Finder what you need')
      .max(500, 'Keep the request under 500 characters')
      .refine((value) => !CONTROL_CHARS.test(value), 'The request contains unsupported characters'),
    filters: z
      .object({
        hasEmail: z.boolean().optional(),
        opportunityTypes: z.array(z.enum(OPPORTUNITY_TYPES)).max(OPPORTUNITY_TYPES.length).optional(),
        minPriority: z.enum(MIN_PRIORITIES).optional(),
        sortBy: z.enum(SORT_OPTIONS).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type NlLeadSearchBody = z.infer<typeof nlLeadSearchSchema>
