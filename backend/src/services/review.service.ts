import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import type { AdminReviewListQuery, ReviewSubmissionInput } from '../validators/review.validator.js'

const RATING_VALUES = [5, 4, 3, 2, 1] as const

export async function submitReview(input: ReviewSubmissionInput) {
  try {
    return await prisma.review.create({
      data: {
        name: input.name,
        email: input.email,
        rating: input.rating,
        reviewText: input.reviewText,
      },
      select: { id: true, status: true, createdAt: true },
    })
  } catch (error) {
    throw new AppError(500, 'We could not submit your review right now. Please try again shortly.', undefined, {
      cause: error,
    })
  }
}

/**
 * Public feed: only ever APPROVED rows, and only the fields a visitor
 * should see — `email` (collected for admin follow-up only) is never
 * selected here. The average/distribution are computed from the exact
 * same APPROVED-only set, both real aggregate queries, never hardcoded.
 */
export async function getPublicReviews() {
  let reviews, avgResult, distribution, total
  try {
    ;[reviews, avgResult, distribution, total] = await Promise.all([
      prisma.review.findMany({
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, rating: true, reviewText: true, createdAt: true },
      }),
      prisma.review.aggregate({ where: { status: 'APPROVED' }, _avg: { rating: true } }),
      prisma.review.groupBy({ by: ['rating'], where: { status: 'APPROVED' }, _count: { _all: true } }),
      prisma.review.count({ where: { status: 'APPROVED' } }),
    ])
  } catch (error) {
    throw new AppError(500, 'A database error occurred while loading reviews.', undefined, { cause: error })
  }

  const byRating = new Map(distribution.map((row) => [row.rating, row._count._all]))
  const summary = {
    average: total > 0 ? Math.round((avgResult._avg.rating ?? 0) * 10) / 10 : null,
    total,
    distribution: Object.fromEntries(RATING_VALUES.map((r) => [r, byRating.get(r) ?? 0])) as Record<
      (typeof RATING_VALUES)[number],
      number
    >,
  }

  return { reviews, summary }
}

const ADMIN_REVIEW_SORT_ORDER: Record<AdminReviewListQuery['sort'], Prisma.ReviewOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  rating_desc: { rating: 'desc' },
  rating_asc: { rating: 'asc' },
}

export async function listAdminReviews(params: AdminReviewListQuery) {
  const where: Prisma.ReviewWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.rating ? { rating: params.rating } : {}),
  }

  let reviews, total
  try {
    ;[reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: ADMIN_REVIEW_SORT_ORDER[params.sort],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.review.count({ where }),
    ])
  } catch (error) {
    throw new AppError(500, 'A database error occurred while listing reviews.', undefined, { cause: error })
  }

  return { reviews, total, page: params.page, pageSize: params.pageSize }
}

async function getReviewOrThrow(id: string) {
  let review
  try {
    review = await prisma.review.findUnique({ where: { id } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while looking up this review.', undefined, { cause: error })
  }
  if (!review) throw new AppError(404, 'Review not found.')
  return review
}

export async function updateReviewStatus(id: string, status: 'APPROVED' | 'REJECTED') {
  await getReviewOrThrow(id)
  try {
    return await prisma.review.update({ where: { id }, data: { status } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while updating this review.', undefined, { cause: error })
  }
}

export async function deleteReview(id: string) {
  await getReviewOrThrow(id)
  try {
    await prisma.review.delete({ where: { id } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while deleting this review.', undefined, { cause: error })
  }
}
