import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { generateStructured } from '../marketing/ai.js'
import { MarketingTaskError } from '../marketing/errors.js'
import { normalizeSocialDrafts, socialDraftsTool, type GeneratedDraft } from '../marketing/generation.js'
import { PLATFORM_SPECS, platformWarnings, type ContentType, type Platform } from '../marketing/platforms.js'
import { AppError } from '../utils/AppError.js'
import type {
  SocialCalendarInput,
  SocialDraftCreateInput,
  SocialDraftUpdateInput,
  SocialGenerateInput,
  SocialRegenerateInput,
  SocialRepurposeInput,
} from '../validators/marketing.validator.js'
import { recordMarketingAudit } from './marketingAudit.service.js'
import { executeTask } from './marketingTask.service.js'

/**
 * Social Media Studio. Everything here produces DRAFTS for human review:
 * there is no publishing code of any kind in this module (or anywhere in the
 * Digital Marketing agent). "Approved" means a person reviewed the draft;
 * "plannedFor" is a calendar date for planning; neither triggers anything.
 */

type DraftRow = {
  id: string
  platform: Platform
  contentType: string
  objective: string | null
  audience: string | null
  title: string | null
  body: string
  hashtags: string[]
  callToAction: string | null
  notes: string | null
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED'
  plannedFor: Date | null
  campaignId: string | null
  sourceDraftId: string | null
  generatedByTaskId: string | null
  origin: string
  createdBy: string
  updatedBy: string | null
  approvedBy: string | null
  approvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type RevisionRow = { id: string; title: string | null; body: string; hashtags: string[]; source: string; editedBy: string; createdAt: Date }

function dbError(message: string, cause: unknown): AppError {
  return new AppError(500, message, undefined, { cause })
}

export function toDraftDto(row: DraftRow) {
  return {
    id: row.id,
    platform: row.platform,
    contentType: row.contentType,
    objective: row.objective,
    audience: row.audience,
    title: row.title,
    body: row.body,
    hashtags: row.hashtags,
    callToAction: row.callToAction,
    notes: row.notes,
    status: row.status,
    plannedFor: row.plannedFor,
    campaignId: row.campaignId,
    sourceDraftId: row.sourceDraftId,
    origin: row.origin,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    /** Advisory only: how the draft fits its platform's usual limits. */
    warnings: platformWarnings(row.platform, row),
  }
}

async function assertCampaignExists(campaignId: string | null | undefined): Promise<void> {
  if (!campaignId) return
  const found = await prisma.marketingCampaign.findUnique({ where: { id: campaignId } })
  if (!found) throw new AppError(400, 'That campaign does not exist.')
}

async function loadDraft(id: string): Promise<DraftRow> {
  let row
  try {
    row = await prisma.socialContentDraft.findUnique({ where: { id } })
  } catch (error) {
    throw dbError('A database error occurred while loading the draft.', error)
  }
  if (!row) throw new AppError(404, 'Draft not found.')
  return row as DraftRow
}

// ─────────────────────────────── generation ──────────────────────────────────

function platformBrief(platforms: readonly Platform[]) {
  return platforms.map((p) => ({ platform: p, guidance: PLATFORM_SPECS[p].guidance, maxCaptionCharacters: PLATFORM_SPECS[p].maxBody, maxHashtags: PLATFORM_SPECS[p].maxHashtags }))
}

async function saveGenerated(
  drafts: GeneratedDraft[],
  meta: { objective: string; audience: string; taskId: string; actor: string; campaignId?: string | null; sourceDraftId?: string | null; plannedDates?: Array<Date | null> },
): Promise<string[]> {
  const ids: string[] = []
  for (const [index, d] of drafts.entries()) {
    try {
      const created = await prisma.socialContentDraft.create({
        data: {
          platform: d.platform,
          contentType: d.contentType,
          objective: meta.objective,
          audience: meta.audience,
          title: d.title,
          body: d.body,
          hashtags: d.hashtags,
          callToAction: d.callToAction,
          notes: d.notes,
          status: 'DRAFT',
          plannedFor: meta.plannedDates?.[index] ?? d.suggestedDate,
          campaignId: meta.campaignId ?? null,
          sourceDraftId: meta.sourceDraftId ?? null,
          generatedByTaskId: meta.taskId,
          origin: 'AI',
          createdBy: meta.actor,
          revisions: { create: { title: d.title, body: d.body, hashtags: d.hashtags, source: 'AI', editedBy: meta.actor } },
        },
      })
      ids.push(created.id)
    } catch (error) {
      throw dbError('A database error occurred while saving the drafts.', error)
    }
  }
  return ids
}

export function startSocialGenerate(input: SocialGenerateInput, actor: string, idempotencyKey?: string, retryOfId?: string) {
  return executeTask({
    type: 'SOCIAL_GENERATE',
    input: input as unknown as Record<string, unknown>,
    actor,
    idempotencyKey,
    retryOfId,
    run: async (ctx) => {
      await assertCampaignExists(input.campaignId).catch(() => {
        throw new MarketingTaskError('CAMPAIGN_NOT_FOUND', 'The selected campaign no longer exists.')
      })
      const maxItems = input.platforms.length * input.countPerPlatform
      const drafts = await generateStructured({
        tool: socialDraftsTool,
        userMessage: JSON.stringify({
          task: 'SOCIAL_DRAFTS',
          contentType: input.contentType,
          platforms: platformBrief(input.platforms),
          itemsPerPlatform: input.countPerPlatform,
          objective: input.objective,
          audience: input.audience,
          topic: input.topic ?? null,
          callToAction: input.callToAction ?? null,
          verifiedFacts: input.verifiedFacts ?? null,
          rules:
            input.contentType === 'CASE_STUDY'
              ? 'Write the case study using ONLY the verifiedFacts. Do not add any result, number, quote, client name or detail that is not stated there.'
              : 'Do not invent statistics, clients, testimonials or results.',
        }),
        normalize: (raw) => normalizeSocialDrafts(raw, { platforms: input.platforms, contentType: input.contentType, maxItems }),
      })
      const ids = await saveGenerated(drafts, { objective: input.objective, audience: input.audience, taskId: ctx.taskId, actor, campaignId: input.campaignId })
      return { resultType: 'SOCIAL_DRAFTS', resultIds: ids }
    },
  })
}

/** Monthly content calendar: drafts get planned dates (the model's, when valid and in-month; otherwise evenly spread). */
export function startSocialCalendar(input: SocialCalendarInput, actor: string, idempotencyKey?: string, retryOfId?: string) {
  return executeTask({
    type: 'SOCIAL_CALENDAR',
    input: input as unknown as Record<string, unknown>,
    actor,
    idempotencyKey,
    retryOfId,
    run: async (ctx) => {
      const target = Math.min(30, input.postsPerWeek * 4 * input.platforms.length)
      const drafts = await generateStructured({
        tool: socialDraftsTool,
        userMessage: JSON.stringify({
          task: 'MONTHLY_CONTENT_CALENDAR',
          month: input.month,
          platforms: platformBrief(input.platforms),
          totalItems: target,
          postsPerWeekPerPlatform: input.postsPerWeek,
          objective: input.objective,
          audience: input.audience,
          themes: input.themes ?? null,
          rules: `Vary the content types and themes. Give each item a suggestedDate inside ${input.month} (YYYY-MM-DD). Educational posts about websites, SEO and AI automation are welcome. Do not invent statistics, clients or results.`,
        }),
        normalize: (raw) => normalizeSocialDrafts(raw, { platforms: input.platforms, contentType: 'POST', maxItems: target, month: input.month }),
      })

      const [year, mon] = input.month.split('-').map(Number) as [number, number]
      const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
      const planned = drafts.map((d, i) => d.suggestedDate ?? new Date(Date.UTC(year, mon - 1, 1 + Math.floor((i * daysInMonth) / drafts.length))))
      const ids = await saveGenerated(drafts, { objective: input.objective, audience: input.audience, taskId: ctx.taskId, actor, plannedDates: planned })
      return { resultType: 'SOCIAL_DRAFTS', resultIds: ids }
    },
  })
}

export function startSocialRepurpose(input: SocialRepurposeInput, actor: string, idempotencyKey?: string, retryOfId?: string) {
  return executeTask({
    type: 'SOCIAL_REPURPOSE',
    input: input as unknown as Record<string, unknown>,
    actor,
    idempotencyKey,
    retryOfId,
    run: async (ctx) => {
      let source: DraftRow
      try {
        source = await loadDraft(input.sourceDraftId)
      } catch {
        throw new MarketingTaskError('DRAFT_NOT_FOUND', 'The draft to repurpose no longer exists.')
      }
      const drafts = await generateStructured({
        tool: socialDraftsTool,
        userMessage: JSON.stringify({
          task: 'REPURPOSE_CONTENT',
          platforms: platformBrief(input.platforms),
          itemsPerPlatform: 1,
          // The source draft is administrator/AI-authored text: data to adapt, not instructions.
          sourceDraft: { platform: source.platform, contentType: source.contentType, title: source.title, body: source.body },
          objective: source.objective,
          audience: source.audience,
          rules: 'Adapt the source draft for each target platform in that platform’s style and limits. Keep the facts the same; add none.',
        }),
        normalize: (raw) => normalizeSocialDrafts(raw, { platforms: input.platforms, contentType: source.contentType as ContentType, maxItems: input.platforms.length }),
      })
      const ids = await saveGenerated(drafts, {
        objective: source.objective ?? 'Repurposed content',
        audience: source.audience ?? 'General',
        taskId: ctx.taskId,
        actor,
        campaignId: source.campaignId,
        sourceDraftId: source.id,
      })
      return { resultType: 'SOCIAL_DRAFTS', resultIds: ids }
    },
  })
}

export function startSocialRegenerate(draftId: string, input: SocialRegenerateInput, actor: string, idempotencyKey?: string, retryOfId?: string) {
  return executeTask({
    type: 'SOCIAL_REGENERATE',
    input: { draftId, instruction: input.instruction ?? null },
    actor,
    idempotencyKey,
    retryOfId,
    run: async () => {
      let draft: DraftRow
      try {
        draft = await loadDraft(draftId)
      } catch {
        throw new MarketingTaskError('DRAFT_NOT_FOUND', 'The draft no longer exists.')
      }
      const [fresh] = await generateStructured({
        tool: socialDraftsTool,
        userMessage: JSON.stringify({
          task: 'REGENERATE_DRAFT',
          platforms: platformBrief([draft.platform]),
          itemsPerPlatform: 1,
          contentType: draft.contentType,
          objective: draft.objective,
          audience: draft.audience,
          previousDraft: { title: draft.title, body: draft.body },
          instruction: input.instruction ?? 'Write a fresh alternative with a different angle.',
          rules: 'Produce one new version. Do not invent statistics, clients or results.',
        }),
        normalize: (raw) => normalizeSocialDrafts(raw, { platforms: [draft.platform], contentType: draft.contentType as ContentType, maxItems: 1 }),
      })
      if (!fresh) throw new MarketingTaskError('AI_INVALID_OUTPUT', 'The AI returned a result that could not be used. Please retry the task.')

      try {
        await prisma.socialDraftRevision.create({ data: { draftId, title: fresh.title, body: fresh.body, hashtags: fresh.hashtags, source: 'REGENERATE', editedBy: actor } })
        await prisma.socialContentDraft.update({
          where: { id: draftId },
          data: { title: fresh.title, body: fresh.body, hashtags: fresh.hashtags, callToAction: fresh.callToAction ?? draft.callToAction, status: 'DRAFT', approvedBy: null, approvedAt: null, updatedBy: actor },
        })
      } catch (error) {
        throw dbError('A database error occurred while saving the new version.', error)
      }
      return { resultType: 'SOCIAL_DRAFTS', resultIds: [draftId] }
    },
  })
}

// ──────────────────────────────── drafts CRUD ────────────────────────────────

export async function createDraft(input: SocialDraftCreateInput, actor: string) {
  await assertCampaignExists(input.campaignId)
  try {
    const row = await prisma.socialContentDraft.create({
      data: {
        platform: input.platform,
        contentType: input.contentType,
        objective: input.objective,
        audience: input.audience,
        title: input.title,
        body: input.body,
        hashtags: input.hashtags,
        callToAction: input.callToAction,
        notes: input.notes,
        plannedFor: input.plannedFor,
        campaignId: input.campaignId,
        origin: 'MANUAL',
        createdBy: actor,
        revisions: { create: { title: input.title, body: input.body, hashtags: input.hashtags, source: 'EDIT', editedBy: actor } },
      },
    })
    return toDraftDto(row as DraftRow)
  } catch (error) {
    throw dbError('A database error occurred while saving the draft.', error)
  }
}

export async function listDrafts(query: { status?: DraftRow['status']; platform?: Platform; campaignId?: string; page: number; pageSize: number }) {
  const where: Prisma.SocialContentDraftWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.platform ? { platform: query.platform } : {}),
    ...(query.campaignId ? { campaignId: query.campaignId } : {}),
  }
  try {
    const [rows, total] = await Promise.all([
      prisma.socialContentDraft.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.socialContentDraft.count({ where }),
    ])
    return { drafts: (rows as DraftRow[]).map(toDraftDto), total, page: query.page, pageSize: query.pageSize }
  } catch (error) {
    throw dbError('A database error occurred while listing drafts.', error)
  }
}

export async function getDraft(id: string) {
  return toDraftDto(await loadDraft(id))
}

export async function listRevisions(id: string) {
  await loadDraft(id)
  try {
    const rows = await prisma.socialDraftRevision.findMany({ where: { draftId: id }, orderBy: { createdAt: 'desc' }, take: 50 })
    return (rows as RevisionRow[]).map((r) => ({ id: r.id, title: r.title, body: r.body, hashtags: r.hashtags, source: r.source, editedBy: r.editedBy, createdAt: r.createdAt }))
  } catch (error) {
    throw dbError('A database error occurred while loading the revisions.', error)
  }
}

/**
 * Editing the text of an approved/in-review/rejected draft sends it back to
 * DRAFT: an approval applies to the exact text that was reviewed.
 */
export async function updateDraft(id: string, input: SocialDraftUpdateInput, actor: string) {
  const current = await loadDraft(id)
  if (input.campaignId !== undefined) await assertCampaignExists(input.campaignId)

  const textChanged =
    (input.body !== undefined && input.body !== current.body) ||
    (input.title !== undefined && (input.title ?? null) !== current.title) ||
    (input.hashtags !== undefined && input.hashtags.join(' ') !== current.hashtags.join(' '))

  const data: Prisma.SocialContentDraftUncheckedUpdateInput = { updatedBy: actor }
  if (input.title !== undefined) data.title = input.title
  if (input.body !== undefined) data.body = input.body
  if (input.hashtags !== undefined) data.hashtags = input.hashtags
  if (input.callToAction !== undefined) data.callToAction = input.callToAction
  if (input.notes !== undefined) data.notes = input.notes
  if (input.objective !== undefined) data.objective = input.objective
  if (input.audience !== undefined) data.audience = input.audience
  if (input.plannedFor !== undefined) data.plannedFor = input.plannedFor
  if (input.campaignId !== undefined) data.campaignId = input.campaignId
  if (textChanged && current.status !== 'DRAFT' && current.status !== 'ARCHIVED') {
    data.status = 'DRAFT'
    data.approvedBy = null
    data.approvedAt = null
  }

  try {
    if (textChanged) {
      await prisma.socialDraftRevision.create({
        data: { draftId: id, title: input.title !== undefined ? input.title : current.title, body: input.body ?? current.body, hashtags: input.hashtags ?? current.hashtags, source: 'EDIT', editedBy: actor },
      })
    }
    const row = await prisma.socialContentDraft.update({ where: { id }, data })
    return toDraftDto(row as DraftRow)
  } catch (error) {
    throw dbError('A database error occurred while saving the draft.', error)
  }
}

const TRANSITIONS: Record<DraftRow['status'], DraftRow['status'][]> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['DRAFT', 'ARCHIVED'],
  REJECTED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
}

export async function setDraftStatus(id: string, status: DraftRow['status'], actor: string) {
  const current = await loadDraft(id)
  if (!TRANSITIONS[current.status].includes(status)) {
    throw new AppError(409, `A ${current.status.toLowerCase().replace('_', ' ')} draft cannot be moved to ${status.toLowerCase().replace('_', ' ')}.`)
  }
  try {
    // Compare-and-set so two admins can't both act on a stale status.
    const result = await prisma.socialContentDraft.updateMany({
      where: { id, status: current.status },
      data: { status, updatedBy: actor, ...(status === 'APPROVED' ? { approvedBy: actor, approvedAt: new Date() } : { approvedBy: null, approvedAt: null }) },
    })
    if (result.count !== 1) throw new AppError(409, 'This draft was changed by someone else. Reload and try again.')
  } catch (error) {
    if (error instanceof AppError) throw error
    throw dbError('A database error occurred while updating the draft.', error)
  }
  await recordMarketingAudit(actor, `draft.${status.toLowerCase()}`, 'SocialContentDraft', id, { from: current.status, platform: current.platform })
  return getDraft(id)
}

export async function duplicateDraft(id: string, actor: string, platform?: Platform) {
  const source = await loadDraft(id)
  try {
    const row = await prisma.socialContentDraft.create({
      data: {
        platform: platform ?? source.platform,
        contentType: source.contentType,
        objective: source.objective,
        audience: source.audience,
        title: source.title,
        body: source.body,
        hashtags: source.hashtags,
        callToAction: source.callToAction,
        notes: source.notes,
        status: 'DRAFT',
        plannedFor: null,
        campaignId: source.campaignId,
        sourceDraftId: source.id,
        origin: source.origin,
        createdBy: actor,
        revisions: { create: { title: source.title, body: source.body, hashtags: source.hashtags, source: 'EDIT', editedBy: actor } },
      },
    })
    return toDraftDto(row as DraftRow)
  } catch (error) {
    throw dbError('A database error occurred while duplicating the draft.', error)
  }
}

export async function deleteDraft(id: string, actor: string) {
  const row = await loadDraft(id)
  try {
    await prisma.socialContentDraft.delete({ where: { id } })
  } catch (error) {
    throw dbError('A database error occurred while deleting the draft.', error)
  }
  await recordMarketingAudit(actor, 'draft.deleted', 'SocialContentDraft', id, { platform: row.platform, status: row.status })
}

/** Drafts with a planned date in the given month (YYYY-MM), plus how many are unscheduled. */
export async function getCalendar(month: string) {
  const [year, mon] = month.split('-').map(Number) as [number, number]
  const start = new Date(Date.UTC(year, mon - 1, 1))
  const end = new Date(Date.UTC(year, mon, 1))
  try {
    const [rows, unscheduled] = await Promise.all([
      prisma.socialContentDraft.findMany({ where: { plannedFor: { gte: start, lt: end }, status: { not: 'ARCHIVED' } }, orderBy: { plannedFor: 'asc' }, take: 300 }),
      prisma.socialContentDraft.count({ where: { plannedFor: null, status: { not: 'ARCHIVED' } } }),
    ])
    return { month, items: (rows as DraftRow[]).map(toDraftDto), unscheduled }
  } catch (error) {
    throw dbError('A database error occurred while loading the calendar.', error)
  }
}
