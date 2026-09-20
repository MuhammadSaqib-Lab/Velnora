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

/**
 * Applied to the Lead Finder's expensive operations (search, re-analyze,
 * generate-email, create-draft) — each one can trigger a Google Places
 * call, up to 20 website fetches, and/or an AI provider call. This is on
 * top of requireAdminToken.ts, not instead of it: the admin gate answers
 * "is this caller allowed at all," this answers "how fast can even an
 * allowed caller trigger paid operations."
 */
export const leadFinderRateLimiter = rateLimit({
  windowMs: env.LEAD_FINDER_RATE_LIMIT_WINDOW_MS,
  limit: env.LEAD_FINDER_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const response: ApiError = {
      success: false,
      message: 'Too many Lead Finder requests. Please wait a moment and try again.',
    }
    res.status(429).json(response)
  },
})

/**
 * Applied to the AI Assistant's two endpoints (command, speak) — each
 * command costs real money against the AI provider, and each spoken
 * reply against ElevenLabs. Admin-only traffic is naturally low-volume,
 * but this still bounds a runaway client bug (e.g. a retry loop) from
 * turning into an unbounded bill the way aiChatRateLimiter does for the
 * public chat endpoint.
 */
export const aiAssistantRateLimiter = rateLimit({
  windowMs: env.AI_ASSISTANT_RATE_LIMIT_WINDOW_MS,
  limit: env.AI_ASSISTANT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const response: ApiError = {
      success: false,
      message: 'Too many AI Assistant requests. Please wait a moment and try again.',
    }
    res.status(429).json(response)
  },
})

/**
 * Applied only to POST /api/auth/admin/login — the primary brute-force
 * defense, since there is no per-account lockout (see
 * adminAuth.service.ts's loginAdmin for why: an account-level lockout
 * would let an attacker lock out the real admin just by submitting wrong
 * passwords for their known email). Keyed by IP only, same as every
 * other limiter in this file.
 */
export const adminLoginRateLimiter = rateLimit({
  windowMs: env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: env.ADMIN_LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const response: ApiError = {
      success: false,
      message: 'Too many login attempts. Please wait a few minutes and try again.',
    }
    res.status(429).json(response)
  },
})
