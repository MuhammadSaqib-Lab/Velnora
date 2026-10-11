import { RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Pagination } from '@/components/internal/Pagination'
import { EmptyState, TableSkeleton } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { selectFieldClass } from '@/components/ui/fieldStyles'
import { apiPost } from '@/lib/api'
import { describeFailure, formatWhen, label, networkMessage, useResource, type PagedOf, type TaskDto } from '@/lib/marketing'
import { LoadError, Notice, PageHeader, Spinner, Tag } from './ui'

const PAGE_SIZE = 20
const TYPES = ['SEO_AUDIT', 'SEO_PLAN', 'SOCIAL_GENERATE', 'SOCIAL_CALENDAR', 'SOCIAL_REPURPOSE', 'SOCIAL_REGENERATE', 'STRATEGY', 'ACQUISITION']
const STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']

const RESULT_LINK: Record<string, string> = {
  SEO_AUDIT: '/internal/admin/marketing/seo?audit=',
  DRAFTS: '/internal/admin/marketing/social',
}

const TONE: Record<string, 'good' | 'bad' | 'warn' | 'neutral'> = { COMPLETED: 'good', FAILED: 'bad', RUNNING: 'warn', PENDING: 'warn', CANCELLED: 'neutral' }

export function MarketingTasks() {
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  const { data, error, loading, reload } = useResource<PagedOf<'tasks', TaskDto>>(`/admin/marketing/tasks?${params}`)

  async function act(task: TaskDto, action: 'retry' | 'cancel') {
    setBusyId(task.id)
    setMessage(null)
    try {
      const res = await apiPost<{ task: TaskDto }>(`/admin/marketing/tasks/${task.id}/${action}`, {})
      if (!res.success) setMessage({ tone: 'error', text: describeFailure(res) })
      else {
        const next = res.data?.task
        setMessage(
          next?.status === 'FAILED'
            ? { tone: 'error', text: next.errorMessage ?? 'The retry failed.' }
            : { tone: 'ok', text: action === 'retry' ? 'Retry started as a new task.' : 'Task cancelled.' },
        )
      }
    } catch (err) {
      setMessage({ tone: 'error', text: networkMessage(err, 'The request failed.') })
    } finally {
      setBusyId(null)
      reload()
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Task history"
        description="Every generation and audit is recorded here. Retrying a task creates a new one with the same input — it can only regenerate drafts or re-run a read-only audit, never publish or send anything."
      />

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className={selectFieldClass}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Filter by type</span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
            className={selectFieldClass}
          >
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" onClick={reload}>
          Refresh
        </Button>
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {loading && !data ? <TableSkeleton rows={6} columns={5} /> : null}
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {data && data.tasks.length === 0 ? <EmptyState message="No tasks match these filters." /> : null}

      {data && data.tasks.length > 0 ? (
        <>
          <ul className="space-y-3">
            {data.tasks.map((task) => (
              <li key={task.id} className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{label(task.type)}</span>
                    <Tag tone={TONE[task.status] ?? 'neutral'}>{label(task.status)}</Tag>
                    {task.retryOfId ? <Tag>Retry</Tag> : null}
                  </div>
                  <span className="text-xs text-[var(--color-ink-faint)]">
                    {formatWhen(task.createdAt)} · {task.createdBy}
                  </span>
                </div>
                {task.errorMessage ? <p className="mt-2 text-sm text-red-300">{task.errorMessage}</p> : null}
                {task.status === 'COMPLETED' && task.resultIds.length > 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                    {task.resultIds.length} result{task.resultIds.length === 1 ? '' : 's'} saved
                    {task.type === 'SEO_AUDIT' && task.resultIds[0] ? (
                      <>
                        {' · '}
                        <a href={`${RESULT_LINK.SEO_AUDIT}${task.resultIds[0]}`} className="text-[var(--color-accent)] underline">
                          open report
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {task.status === 'FAILED' || task.status === 'CANCELLED' ? (
                    <Button variant="secondary" onClick={() => void act(task, 'retry')} disabled={busyId !== null}>
                      {busyId === task.id ? <Spinner /> : <RotateCcw className="h-4 w-4" strokeWidth={1.75} />} Retry
                    </Button>
                  ) : null}
                  {task.status === 'PENDING' || task.status === 'RUNNING' ? (
                    <Button variant="secondary" onClick={() => void act(task, 'cancel')} disabled={busyId !== null}>
                      {busyId === task.id ? <Spinner /> : <XCircle className="h-4 w-4" strokeWidth={1.75} />} Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  )
}
