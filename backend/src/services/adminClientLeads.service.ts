import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'

export interface ListClientLeadsParams {
  status?: string
  intent?: string
  search?: string
  sort?: 'newest' | 'oldest' | 'updated_desc'
  page: number
  pageSize: number
}

const CLIENT_LEAD_SORT_ORDER: Record<NonNullable<ListClientLeadsParams['sort']>, Prisma.QualifiedLeadOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  updated_desc: { updatedAt: 'desc' },
}

export async function listClientLeads(params: ListClientLeadsParams) {
  const where: Prisma.QualifiedLeadWhereInput = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.intent ? { intent: params.intent as never } : {}),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' as const } },
            { email: { contains: params.search, mode: 'insensitive' as const } },
            { company: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  let leads, total
  try {
    ;[leads, total] = await Promise.all([
      prisma.qualifiedLead.findMany({
        where,
        orderBy: CLIENT_LEAD_SORT_ORDER[params.sort ?? 'newest'],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.qualifiedLead.count({ where }),
    ])
  } catch (error) {
    throw new AppError(500, 'A database error occurred while listing leads.', undefined, { cause: error })
  }

  return { leads, total, page: params.page, pageSize: params.pageSize }
}

async function getClientLeadOrThrow(id: string) {
  let lead
  try {
    lead = await prisma.qualifiedLead.findUnique({ where: { id } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while looking up this lead.', undefined, { cause: error })
  }
  if (!lead) throw new AppError(404, 'Lead not found.')
  return lead
}

export async function getClientLead(id: string) {
  return getClientLeadOrThrow(id)
}

/**
 * Conversation content is only ever fetched on explicit request (its own
 * endpoint, not bundled into the lead list or even the lead detail
 * response) — the qualification fields on QualifiedLead itself are
 * enough for routine triage, the full transcript is a deliberate,
 * separate action for when an admin actually needs to see what was said.
 */
export async function getClientLeadConversation(id: string) {
  const lead = await getClientLeadOrThrow(id)

  let conversation
  try {
    conversation = await prisma.aIConversation.findUnique({
      where: { id: lead.conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, createdAt: true } } },
    })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while loading the conversation.', undefined, { cause: error })
  }
  if (!conversation) throw new AppError(404, 'Conversation not found.')

  return conversation
}

export async function updateClientLeadStatus(id: string, status: string) {
  await getClientLeadOrThrow(id)
  try {
    return await prisma.qualifiedLead.update({ where: { id }, data: { status: status as never } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while updating this lead.', undefined, { cause: error })
  }
}
