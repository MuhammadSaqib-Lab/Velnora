import type { Request, Response } from 'express'
import {
  ADMIN_SESSION_COOKIE_NAME,
  adminSessionCookieOptions,
  clearedAdminSessionCookieOptions,
  loginAdmin,
  logoutAdmin,
} from '../services/adminAuth.service.js'
import type { ApiSuccess } from '../types/api.js'
import type { AdminLoginInput } from '../validators/adminAuth.validator.js'

export async function postAdminLogin(req: Request<unknown, unknown, AdminLoginInput>, res: Response) {
  const { email, password } = req.body
  const { sessionToken, expiresAt, admin } = await loginAdmin(email, password, {
    ipAddress: req.ip,
    userAgent: req.header('user-agent'),
  })

  res.cookie(ADMIN_SESSION_COOKIE_NAME, sessionToken, adminSessionCookieOptions(expiresAt))

  const response: ApiSuccess<{ admin: typeof admin }> = { success: true, message: 'Logged in.', data: { admin } }
  res.status(200).json(response)
}

export async function postAdminLogout(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE_NAME] as string | undefined
  if (token) await logoutAdmin(token)

  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, clearedAdminSessionCookieOptions())
  const response: ApiSuccess = { success: true, message: 'Logged out.' }
  res.status(200).json(response)
}

export async function getAdminMe(req: Request, res: Response) {
  const response: ApiSuccess<{ admin: typeof req.adminUser }> = {
    success: true,
    message: 'OK',
    data: { admin: req.adminUser },
  }
  res.status(200).json(response)
}
