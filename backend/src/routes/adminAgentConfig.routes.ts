import { Router } from 'express'
import { AGENTS } from '../agentConfig/agentKeys.js'
import { createAgentConfigController } from '../controllers/adminAgentConfig.controller.js'
import { agentConfigWriteRateLimiter } from '../middleware/rateLimiter.js'
import { validateBody } from '../middleware/validateBody.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { agentConfigRestoreSchema, agentConfigUpdateSchema } from '../validators/agentConfig.validator.js'

/**
 * Mounted under /api/admin/agents by admin.routes.ts, i.e. behind that
 * router's router-wide requireAdminSession() — a real logged-in admin
 * session is required for every route here, reads included (the legacy
 * X-Admin-Token is NOT accepted).
 *
 * One explicit route set PER allowlisted agent, registered in a loop over
 * the fixed AGENTS list: GET/PATCH /customer-handler/config,
 * GET/PATCH /lead-finder/config, plus /history and /restore. There is no
 * `:agent` path parameter, so an unknown slug simply 404s and a known
 * slug can only ever reach its own agent's controller.
 */
export const adminAgentConfigRouter = Router()

for (const agent of AGENTS) {
  const controller = createAgentConfigController(agent.key)
  const base = `/${agent.slug}/config`

  adminAgentConfigRouter.get(base, asyncHandler(controller.getConfig))
  adminAgentConfigRouter.patch(
    base,
    agentConfigWriteRateLimiter,
    validateBody(agentConfigUpdateSchema),
    asyncHandler(controller.putConfig),
  )
  adminAgentConfigRouter.get(`${base}/history`, asyncHandler(controller.getHistory))
  adminAgentConfigRouter.post(
    `${base}/restore`,
    agentConfigWriteRateLimiter,
    validateBody(agentConfigRestoreSchema),
    asyncHandler(controller.postRestore),
  )
}
