import { MAX_LENGTHS, MIN_REVIEW_LENGTH } from './validation'

export interface ReviewFormData {
  name: string
  email: string
  rating: number
  reviewText: string
}

export type ReviewFormErrors = Partial<Record<keyof ReviewFormData, string>>

export function validateReviewForm(data: ReviewFormData): ReviewFormErrors {
  const errors: ReviewFormErrors = {}

  const name = data.name.trim()
  if (!name) {
    errors.name = 'Please enter your name.'
  } else if (name.length > MAX_LENGTHS.name) {
    errors.name = `Keep your name under ${MAX_LENGTHS.name} characters.`
  }

  const email = data.email.trim()
  if (email) {
    if (email.length > MAX_LENGTHS.email) {
      errors.email = 'That email address is too long.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.'
    }
  }

  if (!data.rating || data.rating < 1 || data.rating > 5) {
    errors.rating = 'Please select a rating.'
  }

  const reviewText = data.reviewText.trim()
  if (!reviewText) {
    errors.reviewText = 'Please share a few words about your experience.'
  } else if (reviewText.length < MIN_REVIEW_LENGTH) {
    errors.reviewText = `A few more details would help — at least ${MIN_REVIEW_LENGTH} characters.`
  } else if (reviewText.length > MAX_LENGTHS.reviewText) {
    errors.reviewText = `Keep your review under ${MAX_LENGTHS.reviewText} characters.`
  }

  return errors
}

/** Mirrors backend/prisma/schema.prisma's Review model — only the fields
 * the public GET /api/reviews endpoint actually returns (never `email`,
 * see review.service.ts's getPublicReviews). */
export interface PublicReview {
  id: string
  name: string
  rating: number
  reviewText: string
  createdAt: string
}

export interface ReviewSummary {
  average: number | null
  total: number
  distribution: Record<'5' | '4' | '3' | '2' | '1', number>
}

export interface PublicReviewsResponse {
  reviews: PublicReview[]
  summary: ReviewSummary
}
