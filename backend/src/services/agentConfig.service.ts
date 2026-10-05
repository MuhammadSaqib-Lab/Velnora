import { getAgentDefaults } from '../agentConfig/defaults.js'
import { AGENT_KEYS, type AgentKey } from '../agentConfig/agentKeys.js'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'

/**
 * Single source of truth for an agent's EDITABLE behavior. Every read in
 * this file is scoped to exactly one AgentKey (`where: { agentKey }`) —
 * there is deliberately no "load all configs" function on the runtime
 * path, so a Customer Handler request can never even fetch the Lead
 * Finder's rules/instructions (and vice versa).
 *
 * This is configuration, not authorization: nothing stored here can grant
 * a tool, a permission, or the ability to send email. See
 * backend/src/agentConfig/policies/ for what code always enforces.
 */

export interface AgentRuntimeConfig {
  enabled: boolean
  rules: string
  instructions: string
  version: number
}

export interface AgentConfigDto {
  agentKey: AgentKey
  displayName: string
  rules: string
  instructions: string
  enabled: boolean
  version: number
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AgentConfigVersionDto {
  version: number
  rules: string
  instructions: string
  enabled: boolean
  changeType: string
  changedBy: string | null
  createdAt: Date
}

type ConfigRow = {
  agentKey: AgentKey
  displayName: string
  rules: string
  instructions: string
  enabled: boolean
  version: number
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

const HISTORY_PAGE_SIZE = 25

function toDto(row: ConfigRow): AgentConfigDto {
  // Explicit field list (never spread the row) so a future column — or a
  // join — can't accidentally leak through the API.
  return {
    agentKey: row.agentKey,
    displayName: row.displayName,
    rules: row.rules,
    instructions: row.instructions,
    enabled: row.enabled,
    version: row.version,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function dbError(message: string, cause: unknown): AppError {
  return new AppError(500, message, undefined, { cause })
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

/**
 * Returns the agent's row, creating it from the bootstrap defaults if it
 * does not exist yet (fresh database, or a deploy that has not run the
 * startup bootstrap). Once a row exists the defaults are never consulted
 * again. Safe under concurrent first requests: the unique agentKey makes
 * the loser's insert fail, and it simply re-reads the winner's row.
 */
export async function ensureAgentConfig(key: AgentKey): Promise<ConfigRow> {
  const existing = await prisma.agentConfig.findUnique({ where: { agentKey: key } })
  if (existing) return existing as ConfigRow

  const defaults = getAgentDefaults(key)
  try {
    const created = await prisma.agentConfig.create({
      data: {
        agentKey: key,
        displayName: defaults.displayName,
        rules: defaults.rules,
        instructions: defaults.instructions,
        enabled: true,
        version: 1,
        updatedBy: 'system (initial defaults)',
        history: {
          create: {
            agentKey: key,
            version: 1,
            rules: defaults.rules,
            instructions: defaults.instructions,
            enabled: true,
            changeType: 'SEEDED',
            changedBy: 'system (initial defaults)',
          },
        },
      },
    })
    logger.info('agent_config.seeded', { agentKey: key })
    return created as ConfigRow
  } catch (error) {
    if (isUniqueViolation(error)) {
      const winner = await prisma.agentConfig.findUnique({ where: { agentKey: key } })
      if (winner) return winner as ConfigRow
    }
    throw error
  }
}

/** Startup hook (server.ts): make sure every allowlisted agent has a row. */
export async function bootstrapAgentConfigs(): Promise<void> {
  for (const key of AGENT_KEYS) {
    await ensureAgentConfig(key)
  }
}

/**
 * What an agent's runtime loads before building its prompt. Loads ONLY
 * the requested agent's row.
 */
export async function getAgentRuntimeConfig(key: AgentKey): Promise<AgentRuntimeConfig> {
  let row: ConfigRow
  try {
    row = await ensureAgentConfig(key)
  } catch (error) {
    throw dbError('A database error occurred while loading the agent configuration.', error)
  }
  return { enabled: row.enabled, rules: row.rules, instructions: row.instructions, version: row.version }
}

/** Kill switch check for agent actions that do not otherwise load the config. */
export async function assertAgentEnabled(key: AgentKey): Promise<AgentRuntimeConfig> {
  const config = await getAgentRuntimeConfig(key)
  if (!config.enabled) {
    throw new AppError(
      409,
      'This agent is currently disabled. An administrator can re-enable it under Agent Settings.',
    )
  }
  return config
}

export async function getAgentConfigForAdmin(key: AgentKey): Promise<AgentConfigDto> {
  try {
    return toDto(await ensureAgentConfig(key))
  } catch (error) {
    throw dbError('A database error occurred while loading the agent configuration.', error)
  }
}

export interface AgentConfigChange {
  rules: string
  instructions: string
  enabled: boolean
}

async function applyChange(
  key: AgentKey,
  change: AgentConfigChange,
  expectedVersion: number,
  changeType: 'UPDATED' | 'RESTORED',
  adminEmail: string,
): Promise<{ config: AgentConfigDto; changed: boolean }> {
  const current = await ensureAgentConfig(key)

  if (current.version !== expectedVersion) {
    throw new AppError(
      409,
      'This configuration was changed by someone else. Reload to see the latest version, then re-apply your edit.',
    )
  }

  if (
    current.rules === change.rules &&
    current.instructions === change.instructions &&
    current.enabled === change.enabled
  ) {
    return { config: toDto(current), changed: false }
  }

  const nextVersion = current.version + 1
  const saved = await prisma.$transaction(async (tx) => {
    // Compare-and-set on `version`: if two admins save at once, only one
    // matches and the other gets the 409 below instead of silently
    // overwriting.
    const result = await tx.agentConfig.updateMany({
      where: { agentKey: key, version: expectedVersion },
      data: {
        rules: change.rules,
        instructions: change.instructions,
        enabled: change.enabled,
        version: nextVersion,
        updatedBy: adminEmail,
      },
    })
    if (result.count !== 1) return null

    const row = await tx.agentConfig.findUnique({ where: { agentKey: key } })
    if (!row) return null

    await tx.agentConfigVersion.create({
      data: {
        agentConfigId: row.id,
        agentKey: key,
        version: nextVersion,
        rules: change.rules,
        instructions: change.instructions,
        enabled: change.enabled,
        changeType,
        changedBy: adminEmail,
      },
    })
    return row
  })

  if (!saved) {
    throw new AppError(
      409,
      'This configuration was changed by someone else. Reload to see the latest version, then re-apply your edit.',
    )
  }

  // Metadata only — never the instruction text itself.
  logger.info('agent_config.changed', { agentKey: key, version: nextVersion, changeType, changedBy: adminEmail })
  return { config: toDto(saved as ConfigRow), changed: true }
}

export async function updateAgentConfig(
  key: AgentKey,
  change: AgentConfigChange,
  expectedVersion: number,
  adminEmail: string,
) {
  try {
    return await applyChange(key, change, expectedVersion, 'UPDATED', adminEmail)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw dbError('A database error occurred while saving the agent configuration.', error)
  }
}

export async function listAgentConfigHistory(key: AgentKey): Promise<AgentConfigVersionDto[]> {
  try {
    await ensureAgentConfig(key) // guarantees the SEEDED version exists on a fresh database
    const rows = await prisma.agentConfigVersion.findMany({
      where: { agentKey: key },
      orderBy: { version: 'desc' },
      take: HISTORY_PAGE_SIZE,
    })
    return rows.map((row) => ({
      version: row.version,
      rules: row.rules,
      instructions: row.instructions,
      enabled: row.enabled,
      changeType: row.changeType,
      changedBy: row.changedBy,
      createdAt: row.createdAt,
    }))
  } catch (error) {
    throw dbError('A database error occurred while loading the configuration history.', error)
  }
}

/**
 * Restores an earlier snapshot by writing it as a NEW version (history is
 * append-only; nothing is rewound or deleted).
 */
export async function restoreAgentConfigVersion(
  key: AgentKey,
  versionToRestore: number,
  expectedVersion: number,
  adminEmail: string,
) {
  try {
    const snapshot = await prisma.agentConfigVersion.findUnique({
      where: { agentKey_version: { agentKey: key, version: versionToRestore } },
    })
    if (!snapshot) throw new AppError(404, 'That configuration version does not exist for this agent.')

    return await applyChange(
      key,
      { rules: snapshot.rules, instructions: snapshot.instructions, enabled: snapshot.enabled },
      expectedVersion,
      'RESTORED',
      adminEmail,
    )
  } catch (error) {
    if (error instanceof AppError) throw error
    throw dbError('A database error occurred while restoring the agent configuration.', error)
  }
}
