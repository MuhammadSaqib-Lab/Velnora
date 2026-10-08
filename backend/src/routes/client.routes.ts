import { Router } from 'express'
import {
  getClientProjectById,
  getClientProjects,
  getClientProjectStatusHistory,
  getClientSession,
  postClientLogin,
  postClientLogout,
  postClientProject,
  postClientRegister,
} from '../controllers/client.controller.js'
import { clientLoginRateLimiter, clientProjectRateLimiter, clientRegisterRateLimiter } from '../middleware/rateLimiter.js'
import { requireClientSession } from '../middleware/requireClientSession.js'
import { validateBody } from '../middleware/validateBody.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { clientLoginSchema, clientRegisterSchema } from '../validators/clientAuth.validator.js'
import { projectCreateSchema } from '../validators/project.validator.js'

/**
 * Mounted at /api/client. Public: register/login/logout. Everything else
 * sits behind requireClientSession() — a CLIENT cookie only; admin
 * credentials never satisfy it. There is no status-changing route here
 * at all: clients can read their project's status, only the admin API
 * (requireAdminSession) can change it.
 */
export const clientRouter = Router()

// Everything under /api/client is private to one person (their account, their
// projects). Never let a browser, proxy or CDN store it.
clientRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

clientRouter.post('/auth/register', clientRegisterRateLimiter, validateBody(clientRegisterSchema), asyncHandler(postClientRegister))
clientRouter.post('/auth/login', clientLoginRateLimiter, validateBody(clientLoginSchema), asyncHandler(postClientLogin))
clientRouter.post('/auth/logout', asyncHandler(postClientLogout))

clientRouter.use(requireClientSession())

clientRouter.get('/session', asyncHandler(getClientSession))

clientRouter.get('/projects', asyncHandler(getClientProjects))
clientRouter.post('/projects', clientProjectRateLimiter, validateBody(projectCreateSchema), asyncHandler(postClientProject))
clientRouter.get('/projects/:id', asyncHandler(getClientProjectById))
clientRouter.get('/projects/:id/status-history', asyncHandler(getClientProjectStatusHistory))
