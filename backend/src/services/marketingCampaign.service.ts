import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import type { CampaignCreateInput, CampaignUpdateInput } from '../validators/marketing.validator.js'
import { recordMarketingAudit } from './marketingAudit.service.js'

/**
 * Campaign PLANNING. A campaign here is a record — objective, audience,
 * dates, a planning budget, activities, notes. Setting its status to ACTIVE
 * does NOT start anything anywhere: Velnora has no advertising or publishing
 * integration, nothing is spent, and nothing runs. The UI says so too.
 */

type CampaignRow = {
  id: string
  name: string
  objective: string
  audience: string | null
  market: string | null
  service: string | null
  channel: string | null
  startDate: Date | null
  endDate: Date | null
  budgetAmount: number | null
  budgetCurrency: string | null
  activities: unknown
  successMetrics: string | null
  status: 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'
  notes: string | null
  results: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

function dbError(message: string, cause: unknown): AppError {
  return new AppError(500, message, undefined, { cause })
}

export function toCampaignDto(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    audience: row.audience,
    market: row.market,
    service: row.service,
    channel: row.channel,
    startDate: row.startDate,
    endDate: row.endDate,
    budgetAmount: row.budgetAmount,
    budgetCurrency: row.budgetCurrency,
    activities: Array.isArray(row.activities) ? row.activities : [],
    successMetrics: row.successMetrics,
    status: row.status,
    notes: row.notes,
    results: row.results,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Activity due dates are stored as plain YYYY-MM-DD strings inside the JSON column. */
function storeActivities(activities: CampaignCreateInput['activities']): Prisma.InputJsonValue {
  return activities.map((a) => ({ title: a.title, dueDate: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : null, done: a.done })) as Prisma.InputJsonValue
}

async function loadCampaign(id: string): Promise<CampaignRow> {
  let row
  try {
    row = await prisma.marketingCampaign.findUnique({ where: { id } })
  } catch (error) {
    throw dbError('A database error occurred while loading the campaign.', error)
  }
  if (!row) throw new AppError(404, 'Campaign not found.')
  return row as CampaignRow
}

export async function createCampaign(input: CampaignCreateInput, actor: string) {
  try {
    const row = await prisma.marketingCampaign.create({
      data: {
        name: input.name,
        objective: input.objective,
        audience: input.audience,
        market: input.market,
        service: input.service,
        channel: input.channel,
        startDate: input.startDate,
        endDate: input.endDate,
        budgetAmount: input.budgetAmount,
        budgetCurrency: input.budgetCurrency,
        activities: storeActivities(input.activities),
        successMetrics: input.successMetrics,
        status: input.status,
        notes: input.notes,
        results: input.results,
        createdBy: actor,
      },
    })
    await recordMarketingAudit(actor, 'campaign.created', 'MarketingCampaign', row.id, { status: input.status })
    return toCampaignDto(row as CampaignRow)
  } catch (error) {
    throw dbError('A database error occurred while saving the campaign.', error)
  }
}

export async function listCampaigns(query: { status?: CampaignRow['status']; page: number; pageSize: number }) {
  const where: Prisma.MarketingCampaignWhereInput = query.status ? { status: query.status } : {}
  try {
    const [rows, total] = await Promise.all([
      prisma.marketingCampaign.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.marketingCampaign.count({ where }),
    ])
    return { campaigns: (rows as CampaignRow[]).map(toCampaignDto), total, page: query.page, pageSize: query.pageSize }
  } catch (error) {
    throw dbError('A database error occurred while listing campaigns.', error)
  }
}

export async function getCampaign(id: string) {
  const row = await loadCampaign(id)
  let drafts: Array<{ id: string; platform: string; status: string; title: string | null; plannedFor: Date | null }> = []
  try {
    drafts = (await prisma.socialContentDraft.findMany({ where: { campaignId: id }, orderBy: { createdAt: 'desc' }, take: 50 })) as typeof drafts
  } catch (error) {
    throw dbError('A database error occurred while loading the campaign.', error)
  }
  return {
    ...toCampaignDto(row),
    relatedContent: drafts.map((d) => ({ id: d.id, platform: d.platform, status: d.status, title: d.title, plannedFor: d.plannedFor })),
  }
}

export async function updateCampaign(id: string, input: CampaignUpdateInput, actor: string) {
  const current = await loadCampaign(id)
  const startDate = input.startDate !== undefined ? input.startDate : current.startDate
  const endDate = input.endDate !== undefined ? input.endDate : current.endDate
  if (startDate && endDate && endDate < startDate) throw new AppError(400, 'The end date must be on or after the start date.', { endDate: 'The end date must be on or after the start date' })

  const data: Prisma.MarketingCampaignUncheckedUpdateInput = {}
  for (const key of ['name', 'objective', 'audience', 'market', 'service', 'channel', 'startDate', 'endDate', 'budgetAmount', 'budgetCurrency', 'successMetrics', 'status', 'notes', 'results'] as const) {
    if (input[key] !== undefined) (data as Record<string, unknown>)[key] = input[key]
  }
  if (input.activities !== undefined) data.activities = storeActivities(input.activities)

  try {
    const row = await prisma.marketingCampaign.update({ where: { id }, data })
    if (input.status !== undefined && input.status !== current.status) {
      await recordMarketingAudit(actor, `campaign.${input.status.toLowerCase()}`, 'MarketingCampaign', id, { from: current.status })
    }
    return toCampaignDto(row as CampaignRow)
  } catch (error) {
    throw dbError('A database error occurred while saving the campaign.', error)
  }
}

export async function deleteCampaign(id: string, actor: string) {
  const row = await loadCampaign(id)
  try {
    await prisma.marketingCampaign.delete({ where: { id } })
  } catch (error) {
    throw dbError('A database error occurred while deleting the campaign.', error)
  }
  await recordMarketingAudit(actor, 'campaign.deleted', 'MarketingCampaign', id, { status: row.status })
}
