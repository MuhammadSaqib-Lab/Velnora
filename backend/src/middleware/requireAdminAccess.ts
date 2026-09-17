import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { env } from '../config/env.js'
import { ADMIN_SESSION_COOKIE_NAME, getAdminBySessionToken } from '../services/adminAuth.service.js'
import { tokensMatch } from './requireAdminToken.js'
import type { ApiError } from '../types/api.js'

/**
 * Gates every /api/leads/* route. Accepts EITHER a valid admin session
 * cookie (new — what the Admin Dashboard's browser session sends
 * automatically once an operator has logged in at /admin/login) OR the
 * legacy X-Admin-Token header (Phase 4's original mechanism). Both stay
 * supported so the standalone /internal/lead-finder test page, and any
 * existing script or integration built against the shared token, keep
 * working unchanged — see CLAUDE.md and SECURITY.md's "Admin Dashboard
 * security" section for the full reasoning.
 *
 * Neither method being present/valid is always a 401. Unlike the old
 * requireAdminToken(), an unset LEAD_FINDER_ADMIN_TOKEN no longer forces
 * a blanket 503 here — a correctly-configured admin session is a fully
 * valid way in on its own, so "the legacy token isn't configured" is no
 * longer the same thing as "this endpoint is unusable." The endpoint
 * still never opens without a valid credential of one kind or the other.
 */
export function requireAdminAccess(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[ADMIN_SESSION_COOKIE_NAME] as string | undefined
    const sessionLookup = token ? getAdminBySessionToken(token) : Promise.resolve(null)

    sessionLookup
      .then((admin) => {
        if (admin) {
          req.adminUser = admin
          next()
          return
        }

        if (env.LEAD_FINDER_ADMIN_TOKEN) {
          const provided = req.header('X-Admin-Token')
          if (provided && tokensMatch(provided, env.LEAD_FINDER_ADMIN_TOKEN)) {
            next()
            return
          }
        }

        const response: ApiError = { success: false, message: 'Unauthorized.' }
        res.status(401).json(response)
      })
      .catch(next)
  }
}
