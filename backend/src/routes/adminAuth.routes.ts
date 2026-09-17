import { Router } from 'express'
import { getAdminMe, postAdminLogin, postAdminLogout } from '../controllers/adminAuth.controller.js'
import { adminLoginRateLimiter } from '../middleware/rateLimiter.js'
import { requireAdminSession } from '../middleware/requireAdminSession.js'
import { validateBody } from '../middleware/validateBody.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { adminLoginSchema } from '../validators/adminAuth.validator.js'

export const adminAuthRouter = Router()

adminAuthRouter.post('/login', adminLoginRateLimiter, validateBody(adminLoginSchema), asyncHandler(postAdminLogin))
adminAuthRouter.post('/logout', asyncHandler(postAdminLogout))
adminAuthRouter.get('/me', requireAdminSession(), asyncHandler(getAdminMe))
