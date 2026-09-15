import { Router } from 'express'
import { postChatMessage } from '../controllers/aiChat.controller.js'
import { aiChatRateLimiter } from '../middleware/rateLimiter.js'
import { validateBody } from '../middleware/validateBody.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { chatRequestSchema } from '../validators/aiChat.validator.js'

export const aiChatRouter = Router()

aiChatRouter.post(
  '/chat',
  aiChatRateLimiter,
  validateBody(chatRequestSchema),
  asyncHandler(postChatMessage),
)
