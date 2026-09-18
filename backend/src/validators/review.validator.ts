import { z } from 'zod'
import { emailSchema, nameSchema } from './shared.js'

const MIN_REVIEW_LENGTH = 10
const MAX_REVIEW_LENGTH = 2000

/** Converts an empty string (an untouched optional field) into `undefined`. */
function emptyToUndefined(value: unknown) {
  return value === '' ? undefined : value
}

const optionalEmailSchema = z.preprocess(emptyToUndefined, emailSchema.optional())

export const reviewSubmissionSchema = z
  .object({
    name: nameSchema,
    email: optionalEmailSchema,
    rating: z.coerce
      .number({ invalid_type_error: 'Rating must be a number from 1 to 5' })
      .int('Rating must be a whole number from 1 to 5')
      .min(1, 'Rating must be between 1 and 5')
      .max(5, 'Rating must be between 1 and 5'),
    reviewText: z
      .string()
      .trim()
      .min(MIN_REVIEW_LENGTH, `Review must be at least ${MIN_REVIEW_LENGTH} characters`)
      .max(MAX_REVIEW_LENGTH, `Review must be ${MAX_REVIEW_LENGTH} characters or fewer`),
  })
  .strict()

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>

const REVIEW_SORTS = ['newest', 'oldest', 'rating_desc', 'rating_asc'] as const

export const adminReviewListQuerySchema = z
  .object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    sort: z.enum(REVIEW_SORTS).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>

/**
 * Only APPROVED/REJECTED — moderation only ever moves a review one of
 * two directions from here, there's no "revert to pending" action in
 * the spec, so it isn't exposed as an API capability either.
 */
export const reviewStatusUpdateSchema = z
  .object({ status: z.enum(['APPROVED', 'REJECTED']) })
  .strict()

export type ReviewStatusUpdateInput = z.infer<typeof reviewStatusUpdateSchema>
