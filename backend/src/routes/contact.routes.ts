import { Router } from 'express'
import { postContact } from '../controllers/contact.controller.js'
import { formSubmissionRateLimiter } from '../middleware/rateLimiter.js'
import { validateBody } from '../middleware/validateBody.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { contactSchema } from '../validators/contact.validator.js'

export const contactRouter = Router()

contactRouter.post('/', formSubmissionRateLimiter, validateBody(contactSchema), asyncHandler(postContact))
