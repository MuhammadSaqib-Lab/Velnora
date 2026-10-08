import type { AdminSessionUser } from '../services/adminAuth.service.js'
import type { ClientSessionUser } from '../services/clientAuth.service.js'

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAdminSession/requireAdminAccess once a valid admin session cookie is verified. */
      adminUser?: AdminSessionUser
      /** Set by requireClientSession once a valid CLIENT session cookie is verified (never by an admin cookie). */
      clientUser?: ClientSessionUser
    }
  }
}

export {}
