import { z } from 'zod'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'

/**
 * The numbers behind the Admin Dashboard's sidebar badges: how many items in
 * each section are waiting for an administrator. Each is one indexed COUNT on
 * the section's own status column (no rows are fetched, nothing joins), over
 * statuses the existing models already define:
 *
 *   clientAgentLeads  QualifiedLead.status = NEW                  (captured by the chat agent, not yet looked at)
 *   leadFinder        Lead.status in (NEW, RESEARCHED)            (discovered + researched, not yet triaged —
 *                     discovery saves leads as RESEARCHED, so counting only NEW would always read 0;
 *                     anything already qualified / drafted / contacted / dismissed is NOT counted)
 *   projects          Project.status = NEW_REQUEST                (client submitted, no admin has picked it up)
 *   reviews           Review.status = PENDING                     (awaiting moderation)
 *   digitalMarketing  SocialContentDraft.status = IN_REVIEW       (drafts sent for approval)
 *
 * Only whole numbers are returned — never a name, email or any record content.
 *
 * A section whose query fails is reported as `null` ("unknown"), not 0: a
 * badge that says nothing is honest, a badge that says "0" because the
 * database hiccuped is not. If every section fails the request fails.
 */
export const sidebarCountsSchema = z
  .object({
    clientAgentLeads: z.number().int().nonnegative().nullable(),
    leadFinder: z.number().int().nonnegative().nullable(),
    projects: z.number().int().nonnegative().nullable(),
    reviews: z.number().int().nonnegative().nullable(),
    digitalMarketing: z.number().int().nonnegative().nullable(),
  })
  .strict()

export type SidebarCounts = z.infer<typeof sidebarCountsSchema>

const COUNTERS: Record<keyof SidebarCounts, () => Promise<number>> = {
  clientAgentLeads: () => prisma.qualifiedLead.count({ where: { status: 'NEW' } }),
  leadFinder: () => prisma.lead.count({ where: { status: { in: ['NEW', 'RESEARCHED'] } } }),
  projects: () => prisma.project.count({ where: { status: 'NEW_REQUEST' } }),
  reviews: () => prisma.review.count({ where: { status: 'PENDING' } }),
  digitalMarketing: () => prisma.socialContentDraft.count({ where: { status: 'IN_REVIEW' } }),
}

export async function getSidebarCounts(): Promise<SidebarCounts> {
  const keys = Object.keys(COUNTERS) as Array<keyof SidebarCounts>
  const settled = await Promise.allSettled(keys.map((key) => COUNTERS[key]()))

  const counts: Partial<Record<keyof SidebarCounts, number | null>> = {}
  let failures = 0
  settled.forEach((result, index) => {
    const key = keys[index]!
    if (result.status === 'fulfilled') {
      counts[key] = result.value
    } else {
      failures += 1
      counts[key] = null
      logger.error('admin.counts.section_failed', result.reason, { section: key })
    }
  })

  if (failures === keys.length) {
    throw new AppError(500, 'A database error occurred while loading the sidebar counts.')
  }
  return sidebarCountsSchema.parse(counts)
}
