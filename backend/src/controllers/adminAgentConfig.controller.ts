import type { Request, Response } from 'express'
import type { AgentKey } from '../agentConfig/agentKeys.js'
import {
  getAgentConfigForAdmin,
  listAgentConfigHistory,
  restoreAgentConfigVersion,
  updateAgentConfig,
} from '../services/agentConfig.service.js'
import type { ApiResponse } from '../types/api.js'
import type { AgentConfigRestoreInput, AgentConfigUpdateInput } from '../validators/agentConfig.validator.js'

/**
 * Controller factory: every handler is closed over ONE AgentKey fixed at
 * route-registration time (see adminAgentConfig.routes.ts). Nothing here
 * reads an agent id from the request, so a request can never select a
 * different agent's configuration than the URL it hit.
 *
 * The router is behind requireAdminSession(), so `req.adminUser` is
 * always set by the time these run; the email recorded as `updatedBy`
 * comes from that session, never from the request body.
 */
export function createAgentConfigController(agentKey: AgentKey) {
  const getConfig = async (_req: Request, res: Response): Promise<void> => {
    const config = await getAgentConfigForAdmin(agentKey)
    const response: ApiResponse = { success: true, message: 'OK', data: config }
    res.status(200).json(response)
  }

  const putConfig = async (req: Request, res: Response): Promise<void> => {
    const { expectedVersion, ...change } = req.body as AgentConfigUpdateInput
    const { config, changed } = await updateAgentConfig(agentKey, change, expectedVersion, req.adminUser!.email)
    const response: ApiResponse = {
      success: true,
      message: changed ? 'Configuration saved.' : 'No changes to save.',
      data: config,
    }
    res.status(200).json(response)
  }

  const getHistory = async (_req: Request, res: Response): Promise<void> => {
    const versions = await listAgentConfigHistory(agentKey)
    const response: ApiResponse = { success: true, message: 'OK', data: { versions } }
    res.status(200).json(response)
  }

  const postRestore = async (req: Request, res: Response): Promise<void> => {
    const { version, expectedVersion } = req.body as AgentConfigRestoreInput
    const { config, changed } = await restoreAgentConfigVersion(agentKey, version, expectedVersion, req.adminUser!.email)
    const response: ApiResponse = {
      success: true,
      message: changed ? `Restored version ${version} as a new version.` : 'That version is already the active configuration.',
      data: config,
    }
    res.status(200).json(response)
  }

  return { getConfig, putConfig, getHistory, postRestore }
}
