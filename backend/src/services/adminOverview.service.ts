import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'

const RECENT_LIMIT = 5

/**
 * Every number here is a real Prisma count/query — there is no mock or
 * placeholder data path. If the database is unreachable, the whole
 * request fails with a clear 500 rather than silently rendering zeros
 * (a dashboard showing "0 leads" because the DB is down would be a
 * worse failure mode than an explicit error state).
 */
export async function getOverview() {
  let leadCounts,
    leadByStatus,
    leadByPriority,
    clientLeadCounts,
    clientLeadByStatus,
    clientLeadByIntent,
    recentLeads,
    recentConversations,
    recentDiscoveries,
    recentOutreach

  try {
    ;[
      leadCounts,
      leadByStatus,
      leadByPriority,
      clientLeadCounts,
      clientLeadByStatus,
      clientLeadByIntent,
      recentLeads,
      recentConversations,
      recentDiscoveries,
      recentOutreach,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['priority'], _count: { _all: true } }),
      prisma.qualifiedLead.count(),
      prisma.qualifiedLead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.qualifiedLead.groupBy({ by: ['intent'], _count: { _all: true } }),
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: RECENT_LIMIT,
        select: { id: true, businessName: true, category: true, opportunityScore: true, priority: true, status: true, createdAt: true },
      }),
      prisma.aIConversation.findMany({
        orderBy: { createdAt: 'desc' },
        take: RECENT_LIMIT,
        select: { id: true, status: true, visitorName: true, visitorEmail: true, createdAt: true },
      }),
      prisma.lead.findMany({
        where: { source: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: RECENT_LIMIT,
        select: { id: true, businessName: true, source: true, opportunityTypes: true, createdAt: true },
      }),
      prisma.lead.findMany({
        where: { OR: [{ emailSubject: { not: null } }, { gmailDraftId: { not: null } }] },
        orderBy: { updatedAt: 'desc' },
        take: RECENT_LIMIT,
        select: { id: true, businessName: true, emailSubject: true, gmailDraftId: true, status: true, updatedAt: true },
      }),
    ])
  } catch (error) {
    throw new AppError(500, 'A database error occurred while loading the dashboard overview.', undefined, { cause: error })
  }

  const statusMap = (rows: Array<{ status: string; _count: { _all: number } }>) =>
    Object.fromEntries(rows.map((r) => [r.status, r._count._all]))
  const priorityMap = (rows: Array<{ priority: string | null; _count: { _all: number } }>) =>
    Object.fromEntries(rows.map((r) => [r.priority ?? 'UNSCORED', r._count._all]))
  const intentMap = (rows: Array<{ intent: string; _count: { _all: number } }>) =>
    Object.fromEntries(rows.map((r) => [r.intent, r._count._all]))

  const leadStatusCounts = statusMap(leadByStatus as never)
  const leadPriorityCounts = priorityMap(leadByPriority as never)
  const clientStatusCounts = statusMap(clientLeadByStatus as never)
  const clientIntentCounts = intentMap(clientLeadByIntent as never)

  return {
    totalLeads: leadCounts + clientLeadCounts,
    leadFinder: {
      total: leadCounts,
      newCount: leadStatusCounts.NEW ?? 0,
      researchedCount: leadStatusCounts.RESEARCHED ?? 0,
      qualifiedCount: leadStatusCounts.QUALIFIED ?? 0,
      emailDraftedCount: leadStatusCounts.EMAIL_DRAFTED ?? 0,
      contactedCount: leadStatusCounts.CONTACTED ?? 0,
      repliedCount: leadStatusCounts.REPLIED ?? 0,
      convertedCount: leadStatusCounts.CONVERTED ?? 0,
      disqualifiedCount: leadStatusCounts.DISQUALIFIED ?? 0,
      highPriorityCount: (leadPriorityCounts.EXCELLENT ?? 0) + (leadPriorityCounts.STRONG ?? 0),
      byStatus: leadStatusCounts,
      byPriority: leadPriorityCounts,
    },
    clientAgent: {
      total: clientLeadCounts,
      newCount: clientStatusCounts.NEW ?? 0,
      inProgressCount: clientStatusCounts.IN_PROGRESS ?? 0,
      resolvedCount: clientStatusCounts.RESOLVED ?? 0,
      archivedCount: clientStatusCounts.ARCHIVED ?? 0,
      highIntentCount: clientIntentCounts.HIGH ?? 0,
      byStatus: clientStatusCounts,
      byIntent: clientIntentCounts,
    },
    recentActivity: {
      recentLeads,
      recentConversations,
      recentDiscoveries,
      recentOutreach,
    },
  }
}
