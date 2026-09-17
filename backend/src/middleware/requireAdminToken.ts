import { timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { env } from '../config/env.js'
import type { ApiError } from '../types/api.js'

/**
 * Exported for reuse by requireAdminAccess.ts, which layers the legacy
 * token check underneath the new admin-session check on /api/leads/*.
 */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual requires equal-length buffers; a length mismatch is
  // already a "no match" and never needs to be constant-time itself
  // (the attacker learns nothing new from a length check).
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Gates every /api/leads/* route. There is no user-auth system yet
 * (Phase 3), and this feature triggers paid external API calls (Google
 * Places, the AI provider) and creates drafts in a real Gmail account —
 * it must never be reachable by the general public the way the contact
 * form is. A shared secret checked via header is a deliberately simple,
 * interim measure for a single-operator internal tool; it should be
 * replaced by real authentication/authorization once Phase 3 exists.
 *
 * Fails CLOSED: if LEAD_FINDER_ADMIN_TOKEN is unset, every request here
 * gets a 503, never an open endpoint by accident.
 */
export function requireAdminToken(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!env.LEAD_FINDER_ADMIN_TOKEN) {
      const response: ApiError = {
        success: false,
        message: 'Lead Finder admin access is not configured.',
      }
      res.status(503).json(response)
      return
    }

    const provided = req.header('X-Admin-Token')
    if (!provided || !tokensMatch(provided, env.LEAD_FINDER_ADMIN_TOKEN)) {
      const response: ApiError = { success: false, message: 'Unauthorized.' }
      res.status(401).json(response)
      return
    }

    next()
  }
}
