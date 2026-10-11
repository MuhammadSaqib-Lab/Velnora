import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import { MarketingTaskError } from '../marketing/errors.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import type { TaskType } from '../validators/marketing.validator.js'
import { assertAgentEnabled } from './agentConfig.service.js'
import { recordMarketingAudit } from './marketingAudit.service.js'

/**
 * The Digital Marketing agent's task engine.
 *
 * Every unit of work — an SEO audit, a content generation, a strategy — is a
 * MarketingTask row that records what was asked, which AgentConfig version it
 * ran under, how it ended and what it produced. There is no job queue in this
 * codebase (the Lead Finder runs bounded work inline too), and none is added:
 * these tasks are bounded (an audit has a hard fetch budget, an AI call has a
 * token cap), so they run inline in the request, and the row is the durable
 * record. If the server dies mid-task, the row would be stuck RUNNING; stale
 * RUNNING/PENDING rows are therefore reconciled to FAILED ("interrupted") the
 * next time tasks are touched, and can be retried.
 *
 * Safety properties:
 *  - Duplicate requests (double-click, retry-after-timeout) return the
 *    existing task instead of running again (idempotency key, or an automatic
 *    30-second window over identical input).
 *  - At most MARKETING_MAX_CONCURRENT_TASKS tasks run at once.
 *  - Failures are stored as a short, sanitized sentence + code — never raw
 *    provider/network/database errors.
 *  - Runners only ever create or update drafts/plans/reports in this
 *    database; nothing here publishes, sends or spends, so retrying a task
 *    cannot trigger an external side effect (read-only fetches aside).
 */

export interface TaskContext {
  taskId: string
  actor: string
  configVersion: number | null
}

export interface TaskOutcome {
  resultType: string
  resultIds: string[]
}

export type TaskRunner = (ctx: TaskContext) => Promise<TaskOutcome>

type TaskRow = {
  id: string
  type: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  input: unknown
  configVersion: number | null
  resultType: string | null
  resultIds: unknown
  errorCode: string | null
  errorMessage: string | null
  retryOfId: string | null
  createdBy: string
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const STALE_AFTER_MS = 10 * 60 * 1000
const DEDUPE_WINDOW_MS = 30 * 1000

export function toTaskDto(row: TaskRow) {
  // Explicit field list (never a row spread).
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    input: row.input,
    configVersion: row.configVersion,
    resultType: row.resultType,
    resultIds: Array.isArray(row.resultIds) ? (row.resultIds as string[]) : [],
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    retryOfId: row.retryOfId,
    createdBy: row.createdBy,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function dedupeKey(type: string, actor: string, input: unknown, clientKey?: string): string {
  if (clientKey) return `client:${createHash('sha256').update(`${actor}|${clientKey}`).digest('hex')}`
  const bucket = Math.floor(Date.now() / DEDUPE_WINDOW_MS)
  return `auto:${createHash('sha256').update(`${type}|${actor}|${stableStringify(input)}|${bucket}`).digest('hex')}`
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

function dbError(message: string, cause: unknown): AppError {
  return new AppError(500, message, undefined, { cause })
}

/** Marks tasks that were running when the process died as FAILED so they don't look alive forever. */
export async function reconcileStaleTasks(): Promise<void> {
  try {
    await prisma.marketingTask.updateMany({
      where: { status: { in: ['PENDING', 'RUNNING'] }, createdAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
      data: {
        status: 'FAILED',
        errorCode: 'INTERRUPTED',
        errorMessage: 'This task was interrupted before it finished (the server restarted or timed out). You can retry it.',
        completedAt: new Date(),
      },
    })
  } catch (error) {
    logger.error('marketing.reconcile_failed', error)
  }
}

export interface ExecuteTaskParams {
  type: TaskType
  /** Validated input — stored on the task and re-used by retry. Must contain no secrets. */
  input: Record<string, unknown>
  actor: string
  idempotencyKey?: string
  retryOfId?: string
  run: TaskRunner
}

export interface ExecuteTaskResult {
  task: ReturnType<typeof toTaskDto>
  /** True when an identical request was already running or done and that task is returned instead. */
  deduplicated: boolean
}

export async function executeTask(params: ExecuteTaskParams): Promise<ExecuteTaskResult> {
  // The agent's kill switch applies to everything it does; also pins the config version this task runs under.
  const config = await assertAgentEnabled('DIGITAL_MARKETING')

  await reconcileStaleTasks()

  const key = dedupeKey(params.type, params.actor, params.input, params.idempotencyKey)
  let existing
  try {
    existing = await prisma.marketingTask.findUnique({ where: { idempotencyKey: key } })
  } catch (error) {
    throw dbError('A database error occurred while starting the task.', error)
  }
  if (existing) return { task: toTaskDto(existing as TaskRow), deduplicated: true }

  try {
    const active = await prisma.marketingTask.count({ where: { status: { in: ['PENDING', 'RUNNING'] } } })
    if (active >= env.MARKETING_MAX_CONCURRENT_TASKS) {
      throw new AppError(429, 'Several marketing tasks are already running. Please wait for one to finish and try again.')
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw dbError('A database error occurred while starting the task.', error)
  }

  let created: TaskRow
  try {
    created = (await prisma.marketingTask.create({
      data: {
        type: params.type,
        status: 'PENDING',
        input: params.input as Prisma.InputJsonValue,
        configVersion: config.version,
        idempotencyKey: key,
        retryOfId: params.retryOfId,
        createdBy: params.actor,
      },
    })) as TaskRow
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Lost a race with an identical request: return the winner.
      const winner = await prisma.marketingTask.findUnique({ where: { idempotencyKey: key } })
      if (winner) return { task: toTaskDto(winner as TaskRow), deduplicated: true }
    }
    throw dbError('A database error occurred while starting the task.', error)
  }

  await recordMarketingAudit(params.actor, params.retryOfId ? 'task.retried' : 'task.started', 'MarketingTask', created.id, { type: params.type })

  // PENDING → RUNNING, only if nobody cancelled it in between.
  const started = await prisma.marketingTask.updateMany({
    where: { id: created.id, status: 'PENDING' },
    data: { status: 'RUNNING', startedAt: new Date() },
  })
  if (started.count !== 1) {
    const current = await prisma.marketingTask.findUnique({ where: { id: created.id } })
    return { task: toTaskDto((current ?? created) as TaskRow), deduplicated: false }
  }

  let outcome: TaskOutcome | null = null
  let failure: { code: string; message: string } | null = null
  try {
    outcome = await params.run({ taskId: created.id, actor: params.actor, configVersion: config.version })
  } catch (error) {
    if (error instanceof MarketingTaskError) {
      failure = { code: error.code, message: error.message }
    } else {
      logger.error('marketing.task_failed', error, { taskId: created.id, type: params.type })
      failure = { code: 'INTERNAL', message: 'The task failed unexpectedly and was not completed. You can retry it.' }
    }
  }

  // Compare-and-set so a task cancelled while running stays cancelled.
  const finished = await prisma.marketingTask.updateMany({
    where: { id: created.id, status: 'RUNNING' },
    data: outcome
      ? { status: 'COMPLETED', resultType: outcome.resultType, resultIds: outcome.resultIds, completedAt: new Date() }
      : { status: 'FAILED', errorCode: failure!.code, errorMessage: failure!.message, completedAt: new Date() },
  })
  if (finished.count !== 1) logger.warn('marketing.task_finish_skipped', { taskId: created.id, reason: 'no_longer_running' })

  const final = await prisma.marketingTask.findUnique({ where: { id: created.id } })
  return { task: toTaskDto((final ?? created) as TaskRow), deduplicated: false }
}

export interface TaskListQuery {
  status?: TaskRow['status']
  type?: string
  page: number
  pageSize: number
}

export async function listTasks(query: TaskListQuery) {
  await reconcileStaleTasks()
  const where: Prisma.MarketingTaskWhereInput = { ...(query.status ? { status: query.status } : {}), ...(query.type ? { type: query.type } : {}) }
  try {
    const [rows, total] = await Promise.all([
      prisma.marketingTask.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.marketingTask.count({ where }),
    ])
    return { tasks: (rows as TaskRow[]).map(toTaskDto), total, page: query.page, pageSize: query.pageSize }
  } catch (error) {
    throw dbError('A database error occurred while listing tasks.', error)
  }
}

export async function getTask(id: string) {
  let row
  try {
    row = await prisma.marketingTask.findUnique({ where: { id } })
  } catch (error) {
    throw dbError('A database error occurred while loading the task.', error)
  }
  if (!row) throw new AppError(404, 'Task not found.')
  return row as TaskRow
}

/** Cancels a task that has not finished (PENDING/RUNNING). Finished tasks are left alone. */
export async function cancelTask(id: string, actor: string) {
  const task = await getTask(id)
  if (task.status !== 'PENDING' && task.status !== 'RUNNING') {
    throw new AppError(409, 'Only a task that has not finished can be cancelled.')
  }
  const result = await prisma.marketingTask.updateMany({
    where: { id, status: { in: ['PENDING', 'RUNNING'] } },
    data: { status: 'CANCELLED', completedAt: new Date(), errorCode: 'CANCELLED', errorMessage: 'Cancelled by an administrator.' },
  })
  if (result.count !== 1) throw new AppError(409, 'This task has just finished and can no longer be cancelled.')
  await recordMarketingAudit(actor, 'task.cancelled', 'MarketingTask', id, { type: task.type })
  return toTaskDto((await getTask(id)) as TaskRow)
}

/** A task can be retried only after a failure or cancellation — never while running, never after success. */
export async function assertRetryable(id: string): Promise<TaskRow> {
  const task = await getTask(id)
  if (task.status !== 'FAILED' && task.status !== 'CANCELLED') {
    throw new AppError(409, 'Only a failed or cancelled task can be retried.')
  }
  return task
}
