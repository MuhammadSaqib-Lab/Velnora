import type { Request, Response } from 'express'
import { getPublicReviews, submitReview } from '../services/review.service.js'
import type { ReviewSubmissionInput } from '../validators/review.validator.js'
import type { ApiResponse } from '../types/api.js'

export async function postReview(req: Request, res: Response) {
  const input = req.body as ReviewSubmissionInput
  const review = await submitReview(input)

  const response: ApiResponse = {
    success: true,
    message: 'Thanks for the feedback! Your review will appear once it has been reviewed.',
    data: review,
  }
  res.status(201).json(response)
}

export async function getReviews(_req: Request, res: Response) {
  const result = await getPublicReviews()
  const response: ApiResponse = { success: true, message: 'OK', data: result }
  res.status(200).json(response)
}
