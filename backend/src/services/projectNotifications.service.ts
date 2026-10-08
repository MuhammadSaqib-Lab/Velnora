import { logger } from '../utils/logger.js'

/**
 * Client notification hooks ("your project request has been received",
 * "your project status was updated").
 *
 * Intentionally NOT sending anything yet. The only email integration in
 * this codebase is the Lead Finder's Gmail connector, and that is
 * deliberately draft-only with no send capability anywhere (see
 * GmailProvider.ts and SECURITY.md) — wiring a real sender is a separate
 * decision (provider, domain verification, SPF/DKIM, templates), not
 * something to smuggle in here. These functions are the single place a
 * future transactional-email provider plugs in; call sites already pass
 * everything a template needs. They never throw, so a notification
 * failure can never fail the request that triggered it, and they log
 * metadata only — never the client's email address or project content.
 */
export interface ProjectNotificationContext {
  projectId: string
  projectNumber: string
  clientEmail: string
}

export function notifyProjectSubmitted(context: ProjectNotificationContext): void {
  logger.info('project.notification.skipped', { kind: 'submitted', projectId: context.projectId, reason: 'no_sender_configured' })
}

export function notifyProjectStatusChanged(context: ProjectNotificationContext & { newStatus: string }): void {
  logger.info('project.notification.skipped', {
    kind: 'status_changed',
    projectId: context.projectId,
    newStatus: context.newStatus,
    reason: 'no_sender_configured',
  })
}
