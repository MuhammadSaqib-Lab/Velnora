import { Router } from 'express'
import * as c from '../controllers/adminMarketing.controller.js'
import { marketingTaskRateLimiter } from '../middleware/rateLimiter.js'
import { validateBody } from '../middleware/validateBody.js'
import { validateQuery } from '../middleware/validateQuery.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import * as v from '../validators/marketing.validator.js'

/**
 * Digital Marketing Agent API, mounted at /api/admin/marketing — so it sits
 * behind admin.routes.ts's router-wide requireAdminSession(): a real,
 * logged-in admin session is required for EVERY route here, reads included
 * (the legacy shared token and client-portal sessions are rejected).
 *
 * Routes that start an expensive task (AI generation, SEO audit, retry) also
 * pass through marketingTaskRateLimiter; the number of tasks running at once
 * is capped in the task service. There is deliberately no route that
 * publishes, sends, or spends — only drafts, plans and reports are created.
 *
 * The agent's own rules/instructions are edited through the existing
 * /api/admin/agents/digital-marketing/config endpoints.
 */
export const adminMarketingRouter = Router()
const a = asyncHandler
const task = marketingTaskRateLimiter

adminMarketingRouter.get('/overview', a(c.getOverview))
adminMarketingRouter.get('/integrations', a(c.getIntegrationsHandler))
adminMarketingRouter.get('/settings', a(c.getSettings))
adminMarketingRouter.get('/audit-log', a(c.getAuditLog))

// Tasks
adminMarketingRouter.get('/tasks', validateQuery(v.taskListQuerySchema), a(c.getTasks))
adminMarketingRouter.get('/tasks/:id', a(c.getTaskById))
adminMarketingRouter.post('/tasks/:id/retry', task, a(c.postRetryTask))
adminMarketingRouter.post('/tasks/:id/cancel', a(c.postCancelTask))

// SEO workspace
adminMarketingRouter.post('/seo/audits', task, validateBody(v.seoAuditCreateSchema), a(c.postSeoAudit))
adminMarketingRouter.get('/seo/audits', validateQuery(v.seoAuditListQuerySchema), a(c.getSeoAudits))
adminMarketingRouter.get('/seo/compare', validateQuery(v.seoCompareQuerySchema), a(c.getSeoCompare))
adminMarketingRouter.get('/seo/audits/:id', a(c.getSeoAuditById))
adminMarketingRouter.get('/seo/audits/:id/export', validateQuery(v.exportQuerySchema), a(c.getSeoExport))
adminMarketingRouter.delete('/seo/audits/:id', a(c.deleteSeoAuditById))
adminMarketingRouter.post('/seo/plans', task, validateBody(v.seoPlanSchema), a(c.postSeoPlan))

// Social media studio
adminMarketingRouter.post('/social/generate', task, validateBody(v.socialGenerateSchema), a(c.postSocialGenerate))
adminMarketingRouter.post('/social/calendar', task, validateBody(v.socialCalendarSchema), a(c.postSocialCalendar))
adminMarketingRouter.post('/social/repurpose', task, validateBody(v.socialRepurposeSchema), a(c.postSocialRepurpose))
adminMarketingRouter.get('/social/calendar', validateQuery(v.calendarQuerySchema), a(c.getSocialCalendar))
adminMarketingRouter.get('/social/drafts', validateQuery(v.socialListQuerySchema), a(c.getDrafts))
adminMarketingRouter.post('/social/drafts', validateBody(v.socialDraftCreateSchema), a(c.postDraft))
adminMarketingRouter.get('/social/drafts/:id', a(c.getDraftById))
adminMarketingRouter.patch('/social/drafts/:id', validateBody(v.socialDraftUpdateSchema), a(c.patchDraft))
adminMarketingRouter.delete('/social/drafts/:id', a(c.deleteDraftById))
adminMarketingRouter.get('/social/drafts/:id/revisions', a(c.getDraftRevisions))
adminMarketingRouter.post('/social/drafts/:id/duplicate', validateBody(v.socialDuplicateSchema), a(c.postDraftDuplicate))
adminMarketingRouter.post('/social/drafts/:id/regenerate', task, validateBody(v.socialRegenerateSchema), a(c.postDraftRegenerate))
adminMarketingRouter.post('/social/drafts/:id/status', validateBody(v.contentStatusSchema), a(c.postDraftStatus))

// Strategy engine & client acquisition (planning only — separate from the Lead Finder)
adminMarketingRouter.post('/strategies/generate', task, validateBody(v.strategyGenerateSchema), a(c.postStrategyGenerate))
adminMarketingRouter.post('/acquisition/generate', task, validateBody(v.acquisitionGenerateSchema), a(c.postAcquisitionGenerate))
adminMarketingRouter.get('/strategies', validateQuery(v.strategyListQuerySchema), a(c.getStrategies))
adminMarketingRouter.post('/strategies', validateBody(v.strategyCreateSchema), a(c.postStrategy))
adminMarketingRouter.get('/strategies/:id', a(c.getStrategyById))
adminMarketingRouter.patch('/strategies/:id', validateBody(v.strategyUpdateSchema), a(c.patchStrategy))
adminMarketingRouter.delete('/strategies/:id', a(c.deleteStrategyById))
adminMarketingRouter.post('/strategies/:id/status', validateBody(v.strategyStatusSchema), a(c.postStrategyStatus))
adminMarketingRouter.post('/strategies/:id/items/:index/status', validateBody(v.strategyItemStatusSchema), a(c.postStrategyItemStatus))

// Campaign planner (records only — nothing here starts or spends anything)
adminMarketingRouter.get('/campaigns', validateQuery(v.campaignListQuerySchema), a(c.getCampaigns))
adminMarketingRouter.post('/campaigns', validateBody(v.campaignCreateSchema), a(c.postCampaign))
adminMarketingRouter.get('/campaigns/:id', a(c.getCampaignById))
adminMarketingRouter.patch('/campaigns/:id', validateBody(v.campaignUpdateSchema), a(c.patchCampaign))
adminMarketingRouter.delete('/campaigns/:id', a(c.deleteCampaignById))
