import { Router } from 'express'
import {
  getGmailAuthUrl,
  getGmailOAuthCallback,
  getLeadById,
  getLeads,
  patchStatus,
  postAnalyze,
  postCreateDraft,
  postGenerateEmail,
  postNlSearch,
  postSearch,
} from '../controllers/leads.controller.js'
import { leadFinderRateLimiter } from '../middleware/rateLimiter.js'
import { requireAdminAccess } from '../middleware/requireAdminAccess.js'
import { validateBody } from '../middleware/validateBody.js'
import { validateQuery } from '../middleware/validateQuery.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { nlLeadSearchSchema } from '../validators/nlLeadSearch.validator.js'
import { createDraftSchema, leadListQuerySchema, leadSearchSchema } from '../validators/leadSearch.validator.js'
import { leadStatusUpdateSchema } from '../validators/leadStatus.validator.js'

export const leadsRouter = Router()

// Reached via Google's own browser redirect, which cannot attach a
// session cookie for our API's origin or an X-Admin-Token header — must
// be registered BEFORE requireAdminAccess() below so it never passes
// through that gate. See GmailProvider.ts and leads.controller.ts's
// getGmailOAuthCallback for its own CSRF defense.
leadsRouter.get('/gmail/oauth-callback', asyncHandler(getGmailOAuthCallback))

leadsRouter.use(requireAdminAccess())

leadsRouter.get('/gmail/auth-url', asyncHandler(getGmailAuthUrl))

leadsRouter.post('/search', leadFinderRateLimiter, validateBody(leadSearchSchema), asyncHandler(postSearch))
// Natural-language search: same admin gate and rate limiter as every other
// Lead Finder operation that can trigger paid work (an AI parse + Places +
// website fetches). It feeds the existing pipeline; it adds no new capability.
leadsRouter.post('/nl-search', leadFinderRateLimiter, validateBody(nlLeadSearchSchema), asyncHandler(postNlSearch))
leadsRouter.get('/', validateQuery(leadListQuerySchema), asyncHandler(getLeads))
leadsRouter.get('/:id', asyncHandler(getLeadById))
leadsRouter.post('/:id/analyze', leadFinderRateLimiter, asyncHandler(postAnalyze))
leadsRouter.post('/:id/generate-email', leadFinderRateLimiter, asyncHandler(postGenerateEmail))
leadsRouter.post(
  '/:id/create-draft',
  leadFinderRateLimiter,
  validateBody(createDraftSchema),
  asyncHandler(postCreateDraft),
)
leadsRouter.patch('/:id/status', validateBody(leadStatusUpdateSchema), asyncHandler(patchStatus))
