import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ADMIN_SESSION_COOKIE_NAME, clearedAdminSessionCookieOptions, getAdminBySessionToken } from '../services/adminAuth.service.js'
import type { ApiError } from '../types/api.js'

function unauthorized(res: Response) {
  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, clearedAdminSessionCookieOptions())
  const response: ApiError = { success: false, message: 'Unauthorized. Please sign in again.' }
  res.status(401).json(response)
}

/**
 * Gates every /api/admin/* route (the Admin Dashboard's own API) behind a
 * real, logged-in admin session — no legacy shared-token fallback here,
 * unlike requireAdminAccess.ts on /api/leads/*. This is the dashboard's
 * own namespace, so it's the one place that requires the new
 * authentication mechanism outright.
 */
export function requireAdminSession(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[ADMIN_SESSION_COOKIE_NAME] as string | undefined
    if (!token) {
      unauthorized(res)
      return
    }

    getAdminBySessionToken(token)
      .then((admin) => {
        if (!admin) {
          unauthorized(res)
          return
        }
        req.adminUser = admin
        next()
      })
      .catch(next)
  }
}
