import type { Request, Response } from 'express'
import { AppError } from '../utils/AppError.js'
import type { ApiResponse } from '../types/api.js'
import {
  idempotencyKeySchema,
  type AcquisitionGenerateInput,
  type CampaignCreateInput,
  type CampaignUpdateInput,
  type SeoAuditCreateInput,
  type SeoPlanInput,
  type SocialCalendarInput,
  type SocialDraftCreateInput,
  type SocialDraftUpdateInput,
  type SocialDuplicateInput,
  type SocialGenerateInput,
  type SocialRegenerateInput,
  type SocialRepurposeInput,
  type StrategyCreateInput,
  type StrategyGenerateInput,
  type StrategyUpdateInput,
} from '../validators/marketing.validator.js'
import { listMarketingAuditLog } from '../services/marketingAudit.service.js'
import { createCampaign, deleteCampaign, getCampaign, listCampaigns, updateCampaign } from '../services/marketingCampaign.service.js'
import { retryTask } from '../services/marketingDispatch.service.js'
import { getIntegrations, getMarketingOverview, getMarketingSettings } from '../services/marketingOverview.service.js'
import { compareSeoAudits, deleteSeoAudit, exportSeoAudit, getSeoAudit, listSeoAudits, startSeoAudit, startSeoPlan } from '../services/marketingSeo.service.js'
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  getCalendar,
  getDraft,
  listDrafts,
  listRevisions,
  setDraftStatus,
  startSocialCalendar,
  startSocialGenerate,
  startSocialRegenerate,
  startSocialRepurpose,
  updateDraft,
} from '../services/marketingSocial.service.js'
import {
  createStrategy,
  deleteStrategy,
  getStrategy,
  listStrategies,
  setStrategyItemStatus,
  setStrategyStatus,
  startAcquisitionGenerate,
  startStrategyGenerate,
  updateStrategy,
} from '../services/marketingStrategy.service.js'
import { cancelTask, getTask, listTasks, toTaskDto, type ExecuteTaskResult } from '../services/marketingTask.service.js'

/**
 * Thin handlers. The acting admin always comes from the verified session
 * (`req.adminUser`, set by requireAdminSession), never from the request.
 * Ids in URLs are only lookup keys; every body/query was validated by a
 * strict schema before reaching these functions.
 */

const actor = (req: Request): string => req.adminUser!.email

function send<T>(res: Response, data: T, message = 'OK', status = 200) {
  const response: ApiResponse<T> = { success: true, message, data }
  res.status(status).json(response)
}

function idempotencyKey(req: Request): string | undefined {
  const raw = req.header('Idempotency-Key')
  if (raw === undefined) return undefined
  const parsed = idempotencyKeySchema.safeParse(raw)
  if (!parsed.success) throw new AppError(400, 'The Idempotency-Key header must be 8–100 letters, numbers or - _ . :')
  return parsed.data
}

/** A started task: 201 when newly created, 200 when an identical request was already handled. */
function sendTask(res: Response, result: ExecuteTaskResult) {
  const { task, deduplicated } = result
  const message =
    task.status === 'FAILED' ? (task.errorMessage ?? 'The task failed.') : task.status === 'COMPLETED' ? 'Task completed.' : deduplicated ? 'This request is already being handled.' : `Task ${task.status.toLowerCase()}.`
  send(res, { task, deduplicated }, message, deduplicated ? 200 : 201)
}

// ───────────────────────────── overview & settings ───────────────────────────
export const getOverview = async (_req: Request, res: Response) => send(res, await getMarketingOverview())
export const getIntegrationsHandler = async (_req: Request, res: Response) => send(res, { integrations: await getIntegrations() })
export const getSettings = async (_req: Request, res: Response) => send(res, await getMarketingSettings())
export const getAuditLog = async (_req: Request, res: Response) => send(res, { entries: await listMarketingAuditLog() })

// ──────────────────────────────────── tasks ──────────────────────────────────
export const getTasks = async (_req: Request, res: Response) => send(res, await listTasks(res.locals.query))
export const getTaskById = async (req: Request, res: Response) => send(res, { task: toTaskDto(await getTask(req.params.id as string)) })
export const postRetryTask = async (req: Request, res: Response) => sendTask(res, await retryTask(req.params.id as string, actor(req)))
export const postCancelTask = async (req: Request, res: Response) => send(res, { task: await cancelTask(req.params.id as string, actor(req)) }, 'Task cancelled.')

// ────────────────────────────────────── SEO ──────────────────────────────────
export const postSeoAudit = async (req: Request, res: Response) => sendTask(res, await startSeoAudit(req.body as SeoAuditCreateInput, actor(req), idempotencyKey(req)))
export const postSeoPlan = async (req: Request, res: Response) => sendTask(res, await startSeoPlan(req.body as SeoPlanInput, actor(req), idempotencyKey(req)))
export const getSeoAudits = async (_req: Request, res: Response) => send(res, await listSeoAudits(res.locals.query))
export const getSeoAuditById = async (req: Request, res: Response) => send(res, { audit: await getSeoAudit(req.params.id as string) })
export const deleteSeoAuditById = async (req: Request, res: Response) => {
  await deleteSeoAudit(req.params.id as string, actor(req))
  send(res, null, 'Audit deleted.')
}
export const getSeoCompare = async (_req: Request, res: Response) => {
  const { base, other } = res.locals.query as { base: string; other: string }
  send(res, await compareSeoAudits(base, other))
}
export const getSeoExport = async (req: Request, res: Response) => {
  const { format } = res.locals.query as { format: 'md' | 'json' }
  const file = await exportSeoAudit(req.params.id as string, format)
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.type(file.contentType).send(file.body)
}

// ───────────────────────────────────── social ────────────────────────────────
export const postSocialGenerate = async (req: Request, res: Response) => sendTask(res, await startSocialGenerate(req.body as SocialGenerateInput, actor(req), idempotencyKey(req)))
export const postSocialCalendar = async (req: Request, res: Response) => sendTask(res, await startSocialCalendar(req.body as SocialCalendarInput, actor(req), idempotencyKey(req)))
export const postSocialRepurpose = async (req: Request, res: Response) => sendTask(res, await startSocialRepurpose(req.body as SocialRepurposeInput, actor(req), idempotencyKey(req)))
export const postDraftRegenerate = async (req: Request, res: Response) =>
  sendTask(res, await startSocialRegenerate(req.params.id as string, req.body as SocialRegenerateInput, actor(req), idempotencyKey(req)))
export const getDrafts = async (_req: Request, res: Response) => send(res, await listDrafts(res.locals.query))
export const postDraft = async (req: Request, res: Response) => send(res, { draft: await createDraft(req.body as SocialDraftCreateInput, actor(req)) }, 'Draft saved.', 201)
export const getDraftById = async (req: Request, res: Response) => send(res, { draft: await getDraft(req.params.id as string) })
export const patchDraft = async (req: Request, res: Response) => send(res, { draft: await updateDraft(req.params.id as string, req.body as SocialDraftUpdateInput, actor(req)) }, 'Draft saved.')
export const deleteDraftById = async (req: Request, res: Response) => {
  await deleteDraft(req.params.id as string, actor(req))
  send(res, null, 'Draft deleted.')
}
export const getDraftRevisions = async (req: Request, res: Response) => send(res, { revisions: await listRevisions(req.params.id as string) })
export const postDraftDuplicate = async (req: Request, res: Response) =>
  send(res, { draft: await duplicateDraft(req.params.id as string, actor(req), (req.body as SocialDuplicateInput).platform) }, 'Draft duplicated.', 201)
export const postDraftStatus = async (req: Request, res: Response) =>
  send(res, { draft: await setDraftStatus(req.params.id as string, (req.body as { status: Parameters<typeof setDraftStatus>[1] }).status, actor(req)) }, 'Status updated.')
export const getSocialCalendar = async (_req: Request, res: Response) => send(res, await getCalendar((res.locals.query as { month: string }).month))

// ─────────────────────────────── strategies / acquisition ────────────────────
export const postStrategyGenerate = async (req: Request, res: Response) => sendTask(res, await startStrategyGenerate(req.body as StrategyGenerateInput, actor(req), idempotencyKey(req)))
export const postAcquisitionGenerate = async (req: Request, res: Response) => sendTask(res, await startAcquisitionGenerate(req.body as AcquisitionGenerateInput, actor(req), idempotencyKey(req)))
export const getStrategies = async (_req: Request, res: Response) => send(res, await listStrategies(res.locals.query))
export const postStrategy = async (req: Request, res: Response) => send(res, { strategy: await createStrategy(req.body as StrategyCreateInput, actor(req)) }, 'Plan saved.', 201)
export const getStrategyById = async (req: Request, res: Response) => send(res, { strategy: await getStrategy(req.params.id as string) })
export const patchStrategy = async (req: Request, res: Response) => send(res, { strategy: await updateStrategy(req.params.id as string, req.body as StrategyUpdateInput, actor(req)) }, 'Plan saved.')
export const postStrategyStatus = async (req: Request, res: Response) =>
  send(res, { strategy: await setStrategyStatus(req.params.id as string, (req.body as { status: Parameters<typeof setStrategyStatus>[1] }).status, actor(req)) }, 'Status updated.')
export const postStrategyItemStatus = async (req: Request, res: Response) => {
  const index = Number(req.params.index)
  send(res, { strategy: await setStrategyItemStatus(req.params.id as string, index, (req.body as { status: string }).status, actor(req)) }, 'Task status updated.')
}
export const deleteStrategyById = async (req: Request, res: Response) => {
  await deleteStrategy(req.params.id as string, actor(req))
  send(res, null, 'Plan deleted.')
}

// ───────────────────────────────── campaigns ─────────────────────────────────
export const getCampaigns = async (_req: Request, res: Response) => send(res, await listCampaigns(res.locals.query))
export const postCampaign = async (req: Request, res: Response) => send(res, { campaign: await createCampaign(req.body as CampaignCreateInput, actor(req)) }, 'Campaign saved.', 201)
export const getCampaignById = async (req: Request, res: Response) => send(res, { campaign: await getCampaign(req.params.id as string) })
export const patchCampaign = async (req: Request, res: Response) => send(res, { campaign: await updateCampaign(req.params.id as string, req.body as CampaignUpdateInput, actor(req)) }, 'Campaign saved.')
export const deleteCampaignById = async (req: Request, res: Response) => {
  await deleteCampaign(req.params.id as string, actor(req))
  send(res, null, 'Campaign deleted.')
}
