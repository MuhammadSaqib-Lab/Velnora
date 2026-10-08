import type { NextFunction, Request, RequestHandler, Response } from 'express'
import {
  CLIENT_SESSION_COOKIE_NAME,
  clearedClientSessionCookieOptions,
  getClientBySessionToken,
} from '../services/clientAuth.service.js'
import type { ApiError } from '../types/api.js'

function unauthorized(res: Response) {
  res.clearCookie(CLIENT_SESSION_COOKIE_NAME, clearedClientSessionCookieOptions())
  const response: ApiError = { success: false, message: 'Please sign in to continue.' }
  res.status(401).json(response)
}

/**
 * Gates every authenticated /api/client/* route. Reads ONLY the client
 * session cookie — an admin session cookie (or the legacy admin token)
 * does not satisfy it, so admin credentials never double as a client
 * identity. The identity it sets (`req.clientUser`) is the only source
 * of "who is this" for every project query; request bodies and URL
 * params are never trusted for it.
 */
export function requireClientSession(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[CLIENT_SESSION_COOKIE_NAME] as string | undefined
    if (!token) {
      unauthorized(res)
      return
    }

    getClientBySessionToken(token)
      .then((client) => {
        if (!client) {
          unauthorized(res)
          return
        }
        req.clientUser = client
        next()
      })
      .catch(next)
  }
}
