import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import type { ApiError } from '../types/api.js'

/**
 * Applied only to the public form-submission endpoints (contact,
 * project inquiry), not the whole API, so a burst of legitimate GET
 * traffic (services/projects/health) is never affected. Limits are
 * environment-configurable so they can be tuned per deployment without
 * a code change.
 */
export const formSubmissionRateLimiter = rateLimit({
  windowMs: env.CONTACT_RATE_LIMIT_WINDOW_MS,
  limit: env.CONTACT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const response: ApiError = {
      success: false,
      message: 'Too many requests. Please wait a few minutes and try again.',
    }
    res.status(429).json(response)
  },
})

/**
 * Applied only to POST /api/ai/chat. Tighter and shorter-windowed than
 * the form limiter by design — every request here costs real money
 * against the AI provider, unlike a free database write, so this is the
 * primary defense against turning the endpoint into an unrestricted
 * expensive API (see also AI_MAX_MESSAGES_PER_CONVERSATION for the
 * per-conversation cap).
 */
export const aiChatRateLimiter = rateLimit({
  windowMs: env.AI_CHAT_RATE_LIMIT_WINDOW_MS,
  limit: env.AI_CHAT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const response: ApiError = {
      success: false,
      message: "You're sending messages a little fast — please wait a moment and try again.",
    }
    res.status(429).json(response)
  },
})
