import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { AI_ASSISTANT_DISABLED_MESSAGE, isAiAssistantEnabled } from '../aiAssistant/featureFlag.js'
import type { ApiError } from '../types/api.js'

/**
 * Route gate for the AI Assistant endpoints. Mounted AFTER the admin
 * session gate (so an unauthenticated caller still just gets a 401 and
 * learns nothing) and BEFORE the rate limiter and body validation — so a
 * disabled assistant answers every request identically, whatever the body
 * is, and never reveals its schema or reaches any assistant code.
 *
 * The response is a fixed message: no hint of the implementation, the
 * provider, or which keys are configured.
 */
export function requireAiAssistantEnabled(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (isAiAssistantEnabled()) {
      next()
      return
    }
    const response: ApiError = { success: false, message: AI_ASSISTANT_DISABLED_MESSAGE }
    res.status(503).json(response)
  }
}
