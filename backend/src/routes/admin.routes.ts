import { Router } from 'express'
import { getAdminProjectById, getAdminProjects, patchAdminProjectStatus } from '../controllers/adminProjects.controller.js'
import { getAdminOverview } from '../controllers/adminOverview.controller.js'
import { postAssistantCommand, postAssistantSpeak } from '../controllers/adminAiAssistant.controller.js'
import {
  getClientLeadById,
  getClientLeadConversationById,
  getClientLeads,
  patchClientLeadStatus,
} from '../controllers/adminClientLeads.controller.js'
import { deleteReviewById, getAdminReviews, patchReviewStatus } from '../controllers/adminReviews.controller.js'
import { adminAgentConfigRouter } from './adminAgentConfig.routes.js'
import { aiAssistantRateLimiter } from '../middleware/rateLimiter.js'
import { requireAdminSession } from '../middleware/requireAdminSession.js'
import { requireAiAssistantEnabled } from '../middleware/requireAiAssistantEnabled.js'
import { validateBody } from '../middleware/validateBody.js'
import { validateQuery } from '../middleware/validateQuery.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { assistantCommandSchema, assistantSpeakSchema } from '../validators/aiAssistant.validator.js'
import { clientLeadListQuerySchema, clientLeadStatusUpdateSchema } from '../validators/adminClientLeads.validator.js'
import { adminProjectListQuerySchema, projectStatusUpdateSchema } from '../validators/project.validator.js'
import { adminReviewListQuerySchema, reviewStatusUpdateSchema } from '../validators/review.validator.js'

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

// Editable behavior (rules/instructions) of the Customer Handler and Lead
// Finder agents — configuration only, never permissions. See
// adminAgentConfig.routes.ts.
adminRouter.use('/agents', adminAgentConfigRouter)

adminRouter.get('/client-leads', validateQuery(clientLeadListQuerySchema), asyncHandler(getClientLeads))
adminRouter.get('/client-leads/:id', asyncHandler(getClientLeadById))
adminRouter.get('/client-leads/:id/conversation', asyncHandler(getClientLeadConversationById))
adminRouter.patch(
  '/client-leads/:id/status',
  validateBody(clientLeadStatusUpdateSchema),
  asyncHandler(patchClientLeadStatus),
)

// Client Portal projects: admin-only management (view, search, change
// status). The status is changed here and ONLY here.
adminRouter.get('/projects', validateQuery(adminProjectListQuerySchema), asyncHandler(getAdminProjects))
adminRouter.get('/projects/:id', asyncHandler(getAdminProjectById))
adminRouter.patch('/projects/:id/status', validateBody(projectStatusUpdateSchema), asyncHandler(patchAdminProjectStatus))

adminRouter.get('/reviews', validateQuery(adminReviewListQuerySchema), asyncHandler(getAdminReviews))
adminRouter.patch('/reviews/:id/status', validateBody(reviewStatusUpdateSchema), asyncHandler(patchReviewStatus))
adminRouter.delete('/reviews/:id', asyncHandler(deleteReviewById))

// AI Assistant — TEMPORARILY DISABLED (AI_ASSISTANT_ENABLED, default off; see
// aiAssistant/featureFlag.ts). The routes stay registered, still behind the
// admin session above, but the gate answers 503 "AI Assistant is currently
// disabled." before the rate limiter, validation or any assistant code runs.
// AI Assistant: voice/text console that previews Lead Finder Agent
// actions without executing them (see orchestrator.service.ts). Both
// endpoints cost real money per call (Claude, and ElevenLabs for
// /speak), hence the rate limiter on top of the router-wide session gate.
adminRouter.post(
  '/ai-assistant/command',
  requireAiAssistantEnabled(),
  aiAssistantRateLimiter,
  validateBody(assistantCommandSchema),
  asyncHandler(postAssistantCommand),
)
adminRouter.post(
  '/ai-assistant/speak',
  requireAiAssistantEnabled(),
  aiAssistantRateLimiter,
  validateBody(assistantSpeakSchema),
  asyncHandler(postAssistantSpeak),
)
