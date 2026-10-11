import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { logger } from '../utils/logger.js'

/**
 * Audit trail for sensitive Digital Marketing actions (approvals, status
 * changes, deletions, audits started, retries). Rules/instructions changes
 * are audited separately by the agent-config version history.
 *
 * Best-effort by design: a failure to write the log is logged but never
 * blocks or fails the action it describes. Only ids and short metadata are
 * recorded — never draft text, page content, tokens or personal data.
 */
export async function recordMarketingAudit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await prisma.marketingAuditLog.create({
      data: { actor, action, entityType, entityId, details: (details ?? undefined) as Prisma.InputJsonValue | undefined },
    })
  } catch (error) {
    logger.error('marketing.audit_log_failed', error, { action, entityType })
  }
}

export async function listMarketingAuditLog(limit = 50) {
  const rows = await prisma.marketingAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actor: row.actor,
    details: row.details,
    createdAt: row.createdAt,
  }))
}
