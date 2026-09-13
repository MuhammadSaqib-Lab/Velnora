import type { Request, Response } from 'express'
import { createProjectInquiry } from '../services/projectInquiry.service.js'
import type { ProjectInquiryInput } from '../validators/projectInquiry.validator.js'
import type { ApiResponse } from '../types/api.js'

export async function postProjectInquiry(req: Request, res: Response) {
  const input = req.body as ProjectInquiryInput
  await createProjectInquiry(input)

  const response: ApiResponse = {
    success: true,
    message: 'Your project details have been received. We will follow up within one business day.',
  }
  res.status(201).json(response)
}
