import type { AdminSessionUser } from '../services/adminAuth.service.js'

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAdminSession/requireAdminAccess once a valid admin session cookie is verified. */
      adminUser?: AdminSessionUser
    }
  }
}

export {}
