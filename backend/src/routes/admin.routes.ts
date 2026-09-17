import { Router } from 'express'
import { getAdminOverview } from '../controllers/adminOverview.controller.js'
import {
  getClientLeadById,
  getClientLeadConversationById,
  getClientLeads,
  patchClientLeadStatus,
} from '../controllers/adminClientLeads.controller.js'
import { requireAdminSession } from '../middleware/requireAdminSession.js'
import { validateBody } from '../middleware/validateBody.js'
import { validateQuery } from '../middleware/validateQuery.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { clientLeadListQuerySchema, clientLeadStatusUpdateSchema } from '../validators/adminClientLeads.validator.js'

/**
 * Phase 5: Admin Dashboard. Gated by requireAdminSession() — a real,
 * logged-in AdminUser session (POST /api/auth/admin/login), not the
 * legacy shared X-Admin-Token. This is the dashboard's own namespace, so
 * it's the one place that requires the new authentication mechanism
 * outright rather than also accepting the old token (contrast with
 * /api/leads/*'s requireAdminAccess.ts, which accepts either, for
 * backward compatibility with the standalone Lead Finder test page).
 *
 * Everything here is read-heavy (dashboard views), not the paid-
 * external-API-triggering operations Lead Finder's own router guards
 * with leadFinderRateLimiter. Lead Finder leads themselves stay served
 * from GET /api/leads (already extended for Phase 5's search/filter/sort
 * needs, see leadSearch.validator.ts) rather than duplicated here —
 * this router only adds what didn't already exist: the cross-agent
 * overview, and Client Handling Agent (QualifiedLead) admin views, which
 * had no admin endpoints at all before this phase.
 */
export const adminRouter = Router()

adminRouter.use(requireAdminSession())

adminRouter.get('/overview', asyncHandler(getAdminOverview))

adminRouter.get('/client-leads', validateQuery(clientLeadListQuerySchema), asyncHandler(getClientLeads))
adminRouter.get('/client-leads/:id', asyncHandler(getClientLeadById))
adminRouter.get('/client-leads/:id/conversation', asyncHandler(getClientLeadConversationById))
adminRouter.patch(
  '/client-leads/:id/status',
  validateBody(clientLeadStatusUpdateSchema),
  asyncHandler(patchClientLeadStatus),
)
