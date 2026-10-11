import { createHash } from 'node:crypto'
import { AppError } from '../utils/AppError.js'
import {
  acquisitionGenerateSchema,
  seoAuditCreateSchema,
  seoPlanSchema,
  socialCalendarSchema,
  socialGenerateSchema,
  socialRegenerateSchema,
  socialRepurposeSchema,
  strategyGenerateSchema,
  type TaskType,
} from '../validators/marketing.validator.js'
import { startSeoAudit, startSeoPlan } from './marketingSeo.service.js'
import { startSocialCalendar, startSocialGenerate, startSocialRegenerate, startSocialRepurpose } from './marketingSocial.service.js'
import { startAcquisitionGenerate, startStrategyGenerate } from './marketingStrategy.service.js'
import { assertRetryable, type ExecuteTaskResult } from './marketingTask.service.js'

/**
 * Retry. Re-runs a FAILED/CANCELLED task from its stored input, creating a
 * NEW task (the original stays as history) linked by retryOfId.
 *
 * Safe by construction: every task type only creates or updates drafts,
 * plans and reports in this database (plus read-only fetches for audits).
 * None of them can publish, send or spend, so a retry can never trigger an
 * external side effect — it is exactly as harmless as the original request.
 * The stored input is re-validated with the same schema as a fresh request,
 * so a retry can't bypass checks added since (URL rules, limits…).
 */
export async function retryTask(taskId: string, actor: string): Promise<ExecuteTaskResult> {
  const task = await assertRetryable(taskId)
  const type = task.type as TaskType
  // Guards a double-click on "Retry" without blocking a deliberate second retry later.
  const key = `retry:${createHash('sha256').update(`${taskId}|${Math.floor(Date.now() / 10_000)}`).digest('hex').slice(0, 40)}`

  const parse = <T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }): T => {
    const result = schema.safeParse(task.input)
    if (!result.success) throw new AppError(400, 'This task’s saved input is no longer valid, so it cannot be retried. Start a new task instead.')
    return result.data
  }

  switch (type) {
    case 'SEO_AUDIT':
      return startSeoAudit(parse(seoAuditCreateSchema), actor, key, taskId)
    case 'SEO_PLAN':
      return startSeoPlan(parse(seoPlanSchema), actor, key, taskId)
    case 'SOCIAL_GENERATE':
      return startSocialGenerate(parse(socialGenerateSchema), actor, key, taskId)
    case 'SOCIAL_CALENDAR':
      return startSocialCalendar(parse(socialCalendarSchema), actor, key, taskId)
    case 'SOCIAL_REPURPOSE':
      return startSocialRepurpose(parse(socialRepurposeSchema), actor, key, taskId)
    case 'SOCIAL_REGENERATE': {
      const stored = task.input as { draftId?: unknown; instruction?: unknown }
      if (typeof stored.draftId !== 'string') throw new AppError(400, 'This task cannot be retried.')
      // Re-validate just the instruction with the same schema as a fresh request.
      const instruction = socialRegenerateSchema.safeParse({ instruction: typeof stored.instruction === 'string' ? stored.instruction : undefined })
      if (!instruction.success) throw new AppError(400, 'This task’s saved input is no longer valid, so it cannot be retried. Start a new task instead.')
      return startSocialRegenerate(stored.draftId, instruction.data, actor, key, taskId)
    }
    case 'STRATEGY':
      return startStrategyGenerate(parse(strategyGenerateSchema), actor, key, taskId)
    case 'ACQUISITION':
      return startAcquisitionGenerate(parse(acquisitionGenerateSchema), actor, key, taskId)
    default:
      throw new AppError(400, 'This task type cannot be retried.')
  }
}
