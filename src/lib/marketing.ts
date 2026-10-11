import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, ApiNetworkError, type ApiResult } from '@/lib/api'

/**
 * Types and helpers for the Digital Marketing workspace
 * (src/pages/internal/admin/marketing/). Mirrors the response shapes of
 * backend/src/routes/adminMarketing.routes.ts — kept in this one file rather
 * than generated, matching the project's frontend/backend duplication
 * convention. The allowed platform / status values are duplicated from
 * backend/src/marketing/platforms.ts and validators/marketing.validator.ts;
 * the backend is the authority and re-validates every request.
 */

export const PLATFORMS = ['LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X', 'YOUTUBE'] as const
export type Platform = (typeof PLATFORMS)[number]
export const PLATFORM_LABELS: Record<Platform, string> = {
  LINKEDIN: 'LinkedIn',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  X: 'X',
  YOUTUBE: 'YouTube',
}

export const CONTENT_TYPES = ['POST', 'CAROUSEL', 'SHORT_VIDEO_SCRIPT', 'VIDEO_OUTLINE', 'THREAD', 'CASE_STUDY', 'EDUCATIONAL', 'PROMOTIONAL', 'ANNOUNCEMENT'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const CONTENT_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]
export const CAMPAIGN_STATUSES = ['DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]
export const STRATEGY_STATUSES = ['DRAFT', 'APPROVED', 'ARCHIVED'] as const
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number]
export const ITEM_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED'] as const
export const ACQUISITION_CATEGORIES = ['INBOUND_CONTENT', 'LOCAL_SEO', 'REFERRALS_PARTNERSHIPS', 'SOCIAL_PRESENCE', 'EMAIL_NURTURE', 'PAID_ADS_PLANNING', 'OTHER'] as const

export const label = (value: string): string => value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

/** Status transitions the backend allows for a draft (backend/src/services/marketingSocial.service.ts). Advisory: the server decides. */
export const DRAFT_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'DRAFT', 'ARCHIVED'],
  APPROVED: ['DRAFT', 'ARCHIVED'],
  REJECTED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
}

export interface TaskDto {
  id: string
  type: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  input: unknown
  configVersion: number | null
  resultType: string | null
  resultIds: string[]
  errorCode: string | null
  errorMessage: string | null
  retryOfId: string | null
  createdBy: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export type PagedOf<K extends string, T> = { [P in K]: T[] } & { total: number; page: number; pageSize: number }

export interface Draft {
  id: string
  platform: Platform
  contentType: ContentType
  objective: string | null
  audience: string | null
  title: string | null
  body: string
  hashtags: string[]
  callToAction: string | null
  notes: string | null
  status: ContentStatus
  plannedFor: string | null
  campaignId: string | null
  sourceDraftId: string | null
  origin: string
  createdBy: string
  updatedBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  warnings: string[]
}

export interface DraftRevision {
  id: string
  title: string | null
  body: string
  hashtags: string[]
  source: string
  editedBy: string
  createdAt: string
}

export type FindingLabel = 'VERIFIED' | 'RECOMMENDATION' | 'ESTIMATE' | 'UNAVAILABLE'
export interface Finding {
  id: string
  checkKey: string
  category: string
  label: FindingLabel
  result: 'PASS' | 'WARN' | 'FAIL' | 'INFO' | null
  title: string
  detail: string
  evidence: unknown
  pageUrl: string | null
  impact: number | null
  effort: number | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null
}

export interface AuditSummary {
  pagesCrawled?: number
  truncated?: boolean
  labels?: Partial<Record<FindingLabel, number>>
  results?: Partial<Record<'PASS' | 'WARN' | 'FAIL' | 'INFO', number>>
  dataSources?: Record<string, string>
  [key: string]: unknown
}

export interface Audit {
  id: string
  url: string
  finalUrl: string | null
  domain: string
  kind: 'OWN' | 'COMPETITOR'
  summary: AuditSummary
  createdBy: string
  createdAt: string
  findings?: Finding[]
}

export interface ComparisonRow {
  checkKey: string
  category: string
  title: string
  base: string | null
  other: string | null
  change: 'IMPROVED' | 'REGRESSED' | 'SAME' | 'ONLY_BASE' | 'ONLY_OTHER'
}

export interface PlanItem {
  category?: string
  title: string
  detail: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  effort: 'HIGH' | 'MEDIUM' | 'LOW'
  expectedOutcome?: string
  measurement?: string
  resources?: string
  status: (typeof ITEM_STATUSES)[number]
}

export interface Strategy {
  id: string
  kind: 'STRATEGY' | 'ACQUISITION' | 'SEO_PLAN'
  title: string
  objective: string
  audience: string | null
  evidence: Array<{ kind: 'VERIFIED' | 'ASSUMPTION' | 'ESTIMATE'; text: string }>
  items: PlanItem[]
  kpis: Array<{ name: string; measurement: string }>
  status: StrategyStatus
  origin: string
  createdBy: string
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Activity {
  title: string
  dueDate: string | null
  done: boolean
}

export interface Campaign {
  id: string
  name: string
  objective: string
  audience: string | null
  market: string | null
  service: string | null
  channel: string | null
  startDate: string | null
  endDate: string | null
  budgetAmount: number | null
  budgetCurrency: string | null
  activities: Activity[]
  successMetrics: string | null
  status: CampaignStatus
  notes: string | null
  results: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  relatedContent?: Array<{ id: string; platform: Platform; status: ContentStatus; title: string | null; plannedFor: string | null }>
}

export interface Integration {
  key: string
  name: string
  purpose: string
  status: 'CONFIGURED' | 'AVAILABLE' | 'NOT_CONNECTED'
  supported: boolean
  detail: string
  setupSteps: string[]
}

export interface AuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actor: string
  details: unknown
  createdAt: string
}

export interface AgentSummary {
  enabled: boolean
  configVersion: number
  updatedAt: string
  updatedBy: string | null
}

// ───────────────────────────── helpers ──────────────────────────────────────

export const formatDay = (value: string | null | undefined): string => (value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' }) : '—')
export const formatWhen = (value: string | null | undefined): string => (value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—')
/** `YYYY-MM-DD` from an ISO timestamp (dates are stored as UTC midnight). */
export const toDateInput = (value: string | null | undefined): string => (value ? value.slice(0, 10) : '')

/** Readable one-liner for an ApiErrorResponse, including per-field validation messages. */
export function describeFailure(res: { message: string; errors?: Record<string, string> }): string {
  const details = res.errors ? Object.values(res.errors).filter(Boolean) : []
  return details.length > 0 ? `${res.message} ${details.join(' ')}` : res.message
}

export function networkMessage(err: unknown, fallback: string): string {
  return err instanceof ApiNetworkError ? err.message : fallback
}

export interface Outcome {
  tone: 'ok' | 'error'
  message: string
  task?: TaskDto
}

/**
 * Starts a backend task (POST that returns `{ task, deduplicated }`) and keeps
 * the outcome. A task that the server accepted but that FAILED comes back as a
 * normal response with `task.status === 'FAILED'` and a safe message — shown
 * as an error, never as success.
 */
export function useTaskRunner() {
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const inFlight = useRef(false)

  const run = useCallback(async (path: string, body: unknown): Promise<TaskDto | null> => {
    if (inFlight.current) return null // a second click while one is running does nothing
    inFlight.current = true
    setRunning(true)
    setOutcome(null)
    try {
      const res: ApiResult<{ task: TaskDto; deduplicated: boolean }> = await apiPost(path, body)
      if (!res.success || !res.data) {
        setOutcome({ tone: 'error', message: res.success ? 'Unexpected response.' : describeFailure(res) })
        return null
      }
      const { task, deduplicated } = res.data
      if (task.status === 'COMPLETED') {
        setOutcome({ tone: 'ok', message: deduplicated ? 'An identical request was already completed — showing that result.' : 'Done.', task })
        return task
      }
      if (task.status === 'FAILED' || task.status === 'CANCELLED') {
        setOutcome({ tone: 'error', message: task.errorMessage ?? 'The task did not complete.', task })
        return null
      }
      setOutcome({ tone: 'ok', message: res.message, task })
      return task
    } catch (err) {
      setOutcome({ tone: 'error', message: networkMessage(err, 'The request failed. Please try again.') })
      return null
    } finally {
      inFlight.current = false
      setRunning(false)
    }
  }, [])

  return { run, running, outcome, clear: () => setOutcome(null) }
}

/** Loads one GET endpoint (re-fetching when `path` changes) and exposes loading / error / reload. `path: null` skips loading. */
export function useResource<T>(path: string | null, refreshKey = 0) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: path !== null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    apiGet<T>(path)
      .then((res) => {
        if (cancelled) return
        setState(res.success ? { data: res.data ?? null, error: null, loading: false } : { data: null, error: res.message, loading: false })
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, error: networkMessage(err, 'Failed to load.'), loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [path, nonce, refreshKey])

  return { ...state, reload: () => setNonce((n) => n + 1) }
}
