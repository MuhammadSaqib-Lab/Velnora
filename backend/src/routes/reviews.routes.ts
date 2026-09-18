import { Router } from 'express'
import { getReviews, postReview } from '../controllers/reviews.controller.js'
import { formSubmissionRateLimiter } from '../middleware/rateLimiter.js'
import { validateBody } from '../middleware/validateBody.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { reviewSubmissionSchema } from '../validators/review.validator.js'

export const reviewsRouter = Router()

// Shares formSubmissionRateLimiter with /api/contact and /api/project-inquiry
// (same abuse profile: an anonymous public form submission) rather than a
// bespoke reviews-only limiter — see rateLimiter.ts. Both routes are fully
// public, no admin gate: anyone can submit a review, but only an approved
// one is ever returned by GET.
reviewsRouter.post('/', formSubmissionRateLimiter, validateBody(reviewSubmissionSchema), asyncHandler(postReview))
reviewsRouter.get('/', asyncHandler(getReviews))
