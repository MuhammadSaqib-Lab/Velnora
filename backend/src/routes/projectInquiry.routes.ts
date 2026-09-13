import { Router } from 'express'
import { postProjectInquiry } from '../controllers/projectInquiry.controller.js'
import { formSubmissionRateLimiter } from '../middleware/rateLimiter.js'
import { validateBody } from '../middleware/validateBody.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { projectInquirySchema } from '../validators/projectInquiry.validator.js'

export const projectInquiryRouter = Router()

projectInquiryRouter.post(
  '/',
  formSubmissionRateLimiter,
  validateBody(projectInquirySchema),
  asyncHandler(postProjectInquiry),
)
