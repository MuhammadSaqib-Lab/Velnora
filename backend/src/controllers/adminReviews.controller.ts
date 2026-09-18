import type { Request, Response } from 'express'
import { deleteReview, listAdminReviews, updateReviewStatus } from '../services/review.service.js'
import type { AdminReviewListQuery, ReviewStatusUpdateInput } from '../validators/review.validator.js'
import type { ApiResponse } from '../types/api.js'

export async function getAdminReviews(_req: Request, res: Response) {
  const query = res.locals.query as AdminReviewListQuery
  const result = await listAdminReviews(query)
  const response: ApiResponse = { success: true, message: 'OK', data: result }
  res.status(200).json(response)
}

export async function patchReviewStatus(req: Request, res: Response) {
  const { status } = req.body as ReviewStatusUpdateInput
  const review = await updateReviewStatus(req.params.id as string, status)
  const response: ApiResponse = {
    success: true,
    message: status === 'APPROVED' ? 'Review approved.' : 'Review rejected.',
    data: review,
  }
  res.status(200).json(response)
}

export async function deleteReviewById(req: Request, res: Response) {
  await deleteReview(req.params.id as string)
  const response: ApiResponse = { success: true, message: 'Review deleted.' }
  res.status(200).json(response)
}
