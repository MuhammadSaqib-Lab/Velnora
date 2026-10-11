import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { generateStructured } from '../marketing/ai.js'
import { marketingPlanTool, normalizePlan } from '../marketing/generation.js'
import { sanitizeLine } from '../marketing/text.js'
import { AppError } from '../utils/AppError.js'
import type {
  AcquisitionGenerateInput,
  StrategyCreateInput,
  StrategyGenerateInput,
  StrategyUpdateInput,
} from '../validators/marketing.validator.js'
import { recordMarketingAudit } from './marketingAudit.service.js'
import { executeTask } from './marketingTask.service.js'

type StrategyRow = {
  id: string
  kind: string
  title: string
  objective: string
  audience: string | null
  evidence: unknown
  items: unknown
  kpis: unknown
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED'
  origin: string
  generatedByTaskId: string | null
  createdBy: string
  approvedBy: string | null
  approvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function dbError(message: string, cause: unknown): AppError {
  return new AppError(500, message, undefined, { cause })
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export function toStrategyDto(row: StrategyRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    objective: row.objective,
    audience: row.audience,
    evidence: arr(row.evidence),
    items: arr(row.items),
    kpis: arr(row.kpis),
    status: row.status,
    origin: row.origin,
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function loadStrategy(id: string): Promise<StrategyRow> {
  let row
  try {
    row = await prisma.marketingStrategy.findUnique({ where: { id } })
  } catch (error) {
    throw dbError('A database error occurred while loading the plan.', error)
  }
  if (!row) throw new AppError(404, 'Plan not found.')
  return row as StrategyRow
}

/**
 * The only "verified data" the strategy generators may draw on: a summary of
 * Velnora's own latest completed SEO audit (counts and static check titles,
 * never scraped page text). With no audit there is no verified data, and any
 * evidence the model tags VERIFIED is downgraded to ASSUMPTION.
 */
async function latestOwnAuditContext(): Promise<{ domain: string; date: string; results: unknown; failing: string[] } | null> {
  const audits = await prisma.seoAudit.findMany({ where: { kind: 'OWN' }, orderBy: { createdAt: 'desc' }, take: 1, include: { findings: true } })
  const audit = audits[0] as
    | { domain: string; createdAt: Date; summary: { results?: unknown } | null; findings: Array<{ label: string; result: string | null; title: string }> }
    | undefined
  if (!audit) return null
  return {
    domain: audit.domain,
    date: audit.createdAt.toISOString().slice(0, 10),
    results: audit.summary?.results ?? null,
    failing: audit.findings.filter((f) => f.label === 'VERIFIED' && (f.result === 'FAIL' || f.result === 'WARN')).slice(0, 15).map((f) => sanitizeLine(f.title, 120)),
  }
}

async function savePlan(kind: 'STRATEGY' | 'ACQUISITION', plan: NonNullable<ReturnType<typeof normalizePlan>>, taskId: string, actor: string) {
  try {
    const row = await prisma.marketingStrategy.create({
      data: {
        kind,
        title: plan.title,
        objective: plan.objective,
        audience: plan.audience,
        evidence: plan.evidence as unknown as Prisma.InputJsonValue,
        items: plan.items as unknown as Prisma.InputJsonValue,
        kpis: plan.kpis as unknown as Prisma.InputJsonValue,
        origin: 'AI',
        generatedByTaskId: taskId,
        createdBy: actor,
      },
    })
    return row.id
  } catch (error) {
    throw dbError('A database error occurred while saving the plan.', error)
  }
}

export function startStrategyGenerate(input: StrategyGenerateInput, actor: string, idempotencyKey?: string, retryOfId?: string) {
  return executeTask({
    type: 'STRATEGY',
    input: input as unknown as Record<string, unknown>,
    actor,
    idempotencyKey,
    retryOfId,
    run: async (ctx) => {
      const audit = await latestOwnAuditContext()
      const plan = await generateStructured({
        tool: marketingPlanTool,
        userMessage: JSON.stringify({
          task: 'MARKETING_STRATEGY',
          goal: input.goal,
          audience: input.audience ?? null,
          market: input.market ?? null,
          budgetNote: input.budgetNote ?? null,
          planningHorizon: input.horizon,
          notes: input.notes ?? null,
          verifiedData: audit ? { latestOwnSeoAudit: audit } : null,
          constraints:
            'Cover target audience, customer pain points, service positioning, messaging, content, SEO, social, local/niche opportunities, website conversion, lead-generation ideas, weekly/monthly actions and KPIs. Every item needs priority, effort, an outcome phrased as an estimate, a measurement method and required resources. No guarantees; no invented numbers. Anything not in verifiedData is an ASSUMPTION or ESTIMATE.',
        }),
        normalize: (raw) => normalizePlan(raw, { hasVerifiedData: audit !== null }),
      })
      return { resultType: 'STRATEGY', resultIds: [await savePlan('STRATEGY', plan, ctx.taskId, actor)] }
    },
  })
}

/** Client-acquisition ideas (niches, campaigns, landing pages, lead magnets, audit offers, form/CTA improvements). Separate from the Lead Finder: this plans inbound demand and drafts nothing to send. */
export function startAcquisitionGenerate(input: AcquisitionGenerateInput, actor: string, idempotencyKey?: string, retryOfId?: string) {
  return executeTask({
    type: 'ACQUISITION',
    input: input as unknown as Record<string, unknown>,
    actor,
    idempotencyKey,
    retryOfId,
    run: async (ctx) => {
      const audit = await latestOwnAuditContext()
      const plan = await generateStructured({
        tool: marketingPlanTool,
        userMessage: JSON.stringify({
          task: 'CLIENT_ACQUISITION_IDEAS',
          categories: input.categories,
          service: input.service ?? null,
          niche: input.niche ?? null,
          location: input.location ?? null,
          notes: input.notes ?? null,
          verifiedData: audit ? { latestOwnSeoAudit: audit } : null,
          constraints:
            'Give concrete, inbound-focused ideas only for the requested categories, tagging each item with its category. Do not draft outreach messages, cold emails or direct messages, and do not suggest scraping or contacting people automatically. All outcomes are estimates; invent no numbers or client results.',
        }),
        normalize: (raw) => normalizePlan(raw, { hasVerifiedData: audit !== null }),
      })
      return { resultType: 'STRATEGY', resultIds: [await savePlan('ACQUISITION', plan, ctx.taskId, actor)] }
    },
  })
}

// ───────────────────────────────── CRUD ──────────────────────────────────────

export async function createStrategy(input: StrategyCreateInput, actor: string) {
  try {
    const row = await prisma.marketingStrategy.create({
      data: {
        kind: input.kind,
        title: input.title,
        objective: input.objective,
        audience: input.audience,
        evidence: input.evidence as unknown as Prisma.InputJsonValue,
        items: input.items as unknown as Prisma.InputJsonValue,
        kpis: input.kpis as unknown as Prisma.InputJsonValue,
        origin: 'MANUAL',
        createdBy: actor,
      },
    })
    return toStrategyDto(row as StrategyRow)
  } catch (error) {
    throw dbError('A database error occurred while saving the plan.', error)
  }
}

export async function listStrategies(query: { kind?: string; status?: StrategyRow['status']; page: number; pageSize: number }) {
  const where: Prisma.MarketingStrategyWhereInput = { ...(query.kind ? { kind: query.kind } : {}), ...(query.status ? { status: query.status } : {}) }
  try {
    const [rows, total] = await Promise.all([
      prisma.marketingStrategy.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.marketingStrategy.count({ where }),
    ])
    return { strategies: (rows as StrategyRow[]).map(toStrategyDto), total, page: query.page, pageSize: query.pageSize }
  } catch (error) {
    throw dbError('A database error occurred while listing plans.', error)
  }
}

export async function getStrategy(id: string) {
  return toStrategyDto(await loadStrategy(id))
}

export async function updateStrategy(id: string, input: StrategyUpdateInput, actor: string) {
  const current = await loadStrategy(id)
  const data: Prisma.MarketingStrategyUncheckedUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.objective !== undefined) data.objective = input.objective
  if (input.audience !== undefined) data.audience = input.audience
  if (input.evidence !== undefined) data.evidence = input.evidence as unknown as Prisma.InputJsonValue
  if (input.items !== undefined) data.items = input.items as unknown as Prisma.InputJsonValue
  if (input.kpis !== undefined) data.kpis = input.kpis as unknown as Prisma.InputJsonValue
  // Changing the substance of an approved plan means it needs approving again.
  const substantive = input.title !== undefined || input.objective !== undefined || input.evidence !== undefined || input.items !== undefined
  if (substantive && current.status === 'APPROVED') {
    data.status = 'DRAFT'
    data.approvedBy = null
    data.approvedAt = null
  }
  try {
    const row = await prisma.marketingStrategy.update({ where: { id }, data })
    if (data.status === 'DRAFT') await recordMarketingAudit(actor, 'strategy.approval_reset', 'MarketingStrategy', id)
    return toStrategyDto(row as StrategyRow)
  } catch (error) {
    throw dbError('A database error occurred while saving the plan.', error)
  }
}

export async function setStrategyStatus(id: string, status: StrategyRow['status'], actor: string) {
  const current = await loadStrategy(id)
  if (current.status === status) return toStrategyDto(current)
  try {
    await prisma.marketingStrategy.update({
      where: { id },
      data: status === 'APPROVED' ? { status, approvedBy: actor, approvedAt: new Date() } : { status, approvedBy: null, approvedAt: null },
    })
  } catch (error) {
    throw dbError('A database error occurred while updating the plan.', error)
  }
  await recordMarketingAudit(actor, `strategy.${status.toLowerCase()}`, 'MarketingStrategy', id, { from: current.status })
  return getStrategy(id)
}

export async function setStrategyItemStatus(id: string, index: number, status: string, actor: string) {
  const current = await loadStrategy(id)
  const items = arr(current.items) as Array<Record<string, unknown>>
  if (!Number.isInteger(index) || index < 0 || index >= items.length) throw new AppError(404, 'That plan item does not exist.')
  items[index] = { ...items[index], status }
  try {
    const row = await prisma.marketingStrategy.update({ where: { id }, data: { items: items as unknown as Prisma.InputJsonValue } })
    await recordMarketingAudit(actor, 'strategy.item_status', 'MarketingStrategy', id, { index, status })
    return toStrategyDto(row as StrategyRow)
  } catch (error) {
    throw dbError('A database error occurred while updating the plan.', error)
  }
}

export async function deleteStrategy(id: string, actor: string) {
  const row = await loadStrategy(id)
  try {
    await prisma.marketingStrategy.delete({ where: { id } })
  } catch (error) {
    throw dbError('A database error occurred while deleting the plan.', error)
  }
  await recordMarketingAudit(actor, 'strategy.deleted', 'MarketingStrategy', id, { kind: row.kind, status: row.status })
}
