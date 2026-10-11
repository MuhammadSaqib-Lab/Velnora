import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pagination } from '@/components/internal/Pagination'
import { EmptyState, TableSkeleton } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { fieldInputClass, selectFieldClass } from '@/components/ui/fieldStyles'
import { apiDelete, apiPatch, apiPost } from '@/lib/api'
import { ITEM_STATUSES, describeFailure, formatWhen, label, networkMessage, useResource, type PagedOf, type Strategy } from '@/lib/marketing'
import { cn } from '@/lib/utils'
import { ConfirmAction, FormRow, Loading, LoadError, Notice, Panel, Spinner, Tag } from './ui'

const PAGE_SIZE = 10
const KIND_TEXT: Record<Strategy['kind'], string> = { STRATEGY: 'Strategy', SEO_PLAN: 'SEO plan', ACQUISITION: 'Client acquisition' }
const EVIDENCE_TONE = { VERIFIED: 'good', ASSUMPTION: 'neutral', ESTIMATE: 'warn' } as const
const PRIORITY_TONE = { HIGH: 'bad', MEDIUM: 'warn', LOW: 'neutral' } as const
const STATUS_TONE = { DRAFT: 'neutral', APPROVED: 'good', ARCHIVED: 'neutral' } as const

/**
 * Lists, opens and manages saved plans of the given kind(s). The generator
 * forms live in the pages that use this (each has its own inputs); this part
 * is the same for strategies, SEO plans and client-acquisition plans.
 */
export function PlanWorkspace({ kinds, refreshKey, emptyText }: { kinds: Array<Strategy['kind']>; refreshKey: number; emptyText: string }) {
  const [params, setParams] = useSearchParams()
  const open = params.get('open')
  const [kind, setKind] = useState<Strategy['kind']>(kinds[0]!)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), kind })
  if (status) query.set('status', status)
  const { data, error, loading, reload } = useResource<PagedOf<'strategies', Strategy>>(`/admin/marketing/strategies?${query}`, refreshKey + version)

  const select = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('open', id)
    else next.delete('open')
    setParams(next)
  }
  const changed = () => {
    setVersion((v) => v + 1)
    reload()
  }

  return (
    <div className="space-y-6">
      {open ? <PlanDetail key={open} id={open} onClose={() => select(null)} onChanged={changed} /> : null}
      <Panel title="Saved plans">
        <div className="mb-4 flex flex-wrap gap-3">
          {kinds.length > 1 ? (
            <label>
              <span className="sr-only">Plan type</span>
              <select value={kind} onChange={(e) => { setKind(e.target.value as Strategy['kind']); setPage(1) }} className={selectFieldClass}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {KIND_TEXT[k]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span className="sr-only">Status</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selectFieldClass}>
              <option value="">All statuses</option>
              {['DRAFT', 'APPROVED', 'ARCHIVED'].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading && !data ? <TableSkeleton rows={3} columns={3} /> : null}
        {error ? <LoadError message={error} onRetry={reload} /> : null}
        {data && data.strategies.length === 0 ? <EmptyState message={emptyText} /> : null}
        {data && data.strategies.length > 0 ? (
          <>
            <ul className="space-y-3">
              {data.strategies.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => select(plan.id)}
                    className={cn('block w-full rounded-[var(--radius-field)] border p-3.5 text-left transition-colors hover:border-white/[0.3]', open === plan.id ? 'border-[var(--color-accent)]/50 bg-white/[0.04]' : 'border-white/[0.08] bg-white/[0.02]')}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{plan.title}</span>
                      <Tag tone={STATUS_TONE[plan.status]}>{label(plan.status)}</Tag>
                      <Tag>{KIND_TEXT[plan.kind]}</Tag>
                      {plan.origin === 'AI' ? <Tag>AI draft</Tag> : null}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm text-[var(--color-ink-muted)]">{plan.objective}</span>
                    <span className="mt-1.5 block text-xs text-[var(--color-ink-faint)]">
                      {plan.items.length} step{plan.items.length === 1 ? '' : 's'} · Updated {formatWhen(plan.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        ) : null}
      </Panel>
    </div>
  )
}

function PlanDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useResource<{ strategy: Strategy }>(`/admin/marketing/strategies/${id}`)
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const plan = data?.strategy

  useEffect(() => {
    if (plan) {
      setTitle(plan.title)
      setObjective(plan.objective)
    }
  }, [plan])

  async function act(fn: () => Promise<{ success: boolean; message: string; errors?: Record<string, string> }>, okText: string, closeAfter = false) {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fn()
      if (res.success) {
        setNotice({ tone: 'ok', text: okText })
        onChanged()
        reload()
        if (closeAfter) onClose()
      } else setNotice({ tone: 'error', text: describeFailure(res) })
    } catch (err) {
      setNotice({ tone: 'error', text: networkMessage(err, 'The request failed.') })
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) return <Loading text="Loading plan…" />
  if (error || !plan) return <LoadError message={error ?? 'Plan not found.'} onRetry={reload} />
  const dirty = title !== plan.title || objective !== plan.objective
  const statusButtons: Array<[Strategy['status'], string]> =
    plan.status === 'DRAFT' ? [['APPROVED', 'Approve plan'], ['ARCHIVED', 'Archive']] : plan.status === 'APPROVED' ? [['DRAFT', 'Back to draft'], ['ARCHIVED', 'Archive']] : [['DRAFT', 'Restore to draft']]

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{KIND_TEXT[plan.kind]}</h3>
          <Tag tone={STATUS_TONE[plan.status]}>{label(plan.status)}</Tag>
        </div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
        {plan.origin === 'AI' ? 'AI-generated — a starting point, not a forecast.' : 'Written by hand.'} · {plan.createdBy} · {formatWhen(plan.createdAt)}
        {plan.approvedBy ? ` · Approved by ${plan.approvedBy}` : ''}
      </p>

      <div className="mt-4 grid gap-4">
        <FormRow id="p-title" label="Title">
          <input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={fieldInputClass} />
        </FormRow>
        <FormRow id="p-objective" label="Objective">
          <textarea id="p-objective" value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} maxLength={600} className={cn(fieldInputClass, 'resize-y')} />
        </FormRow>
        {plan.audience ? <p className="text-sm text-[var(--color-ink-muted)]"><span className="font-medium text-[var(--color-ink)]">Audience:</span> {plan.audience}</p> : null}
      </div>

      {plan.evidence.length > 0 ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold">What this is based on</h4>
          <ul className="mt-2 space-y-2">
            {plan.evidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Tag tone={EVIDENCE_TONE[e.kind]}>{label(e.kind)}</Tag>
                <span className="text-[var(--color-ink-muted)]">{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5">
        <h4 className="text-sm font-semibold">Steps</h4>
        {plan.items.length === 0 ? <p className="mt-2 text-sm text-[var(--color-ink-faint)]">No steps in this plan.</p> : null}
        <ol className="mt-2 space-y-3">
          {plan.items.map((item, index) => (
            <li key={index} className="rounded-[var(--radius-field)] border border-white/[0.08] bg-white/[0.02] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{item.title}</span>
                <Tag tone={PRIORITY_TONE[item.priority]}>{label(item.priority)} priority</Tag>
                <Tag>{label(item.effort)} effort</Tag>
                {item.category ? <Tag>{label(item.category)}</Tag> : null}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--color-ink-muted)]">{item.detail}</p>
              <dl className="mt-2 space-y-1 text-xs text-[var(--color-ink-faint)]">
                {item.expectedOutcome ? <div><dt className="inline font-medium">Possible outcome: </dt><dd className="inline">{item.expectedOutcome}</dd></div> : null}
                {item.measurement ? <div><dt className="inline font-medium">Measure with: </dt><dd className="inline">{item.measurement}</dd></div> : null}
                {item.resources ? <div><dt className="inline font-medium">Needs: </dt><dd className="inline">{item.resources}</dd></div> : null}
              </dl>
              <div className="mt-3">
                <label className="text-xs text-[var(--color-ink-faint)]" htmlFor={`item-${index}`}>
                  Progress
                </label>{' '}
                <select
                  id={`item-${index}`}
                  value={item.status}
                  disabled={busy}
                  onChange={(e) => void act(() => apiPost(`/admin/marketing/strategies/${id}/items/${index}/status`, { status: e.target.value }), 'Step updated.')}
                  className={cn(selectFieldClass, 'ml-1 inline-block w-auto py-1.5')}
                >
                  {ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {plan.kpis.length > 0 ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold">How to measure it</h4>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-muted)]">
            {plan.kpis.map((k) => (
              <li key={k.name}><span className="font-medium text-[var(--color-ink)]">{k.name}</span> — {k.measurement}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={() => void act(() => apiPatch(`/admin/marketing/strategies/${id}`, { title: title.trim(), objective: objective.trim() }), plan.status === 'APPROVED' ? 'Saved. Changing an approved plan sends it back to Draft.' : 'Saved.')} disabled={!dirty || busy || title.trim().length < 3 || objective.trim().length < 3}>
          {busy ? <Spinner /> : null} Save changes
        </Button>
        {statusButtons.map(([next, text]) => (
          <Button key={next} variant="secondary" disabled={busy || dirty} title={dirty ? 'Save your edits first' : undefined} onClick={() => void act(() => apiPost(`/admin/marketing/strategies/${id}/status`, { status: next }), `Status changed to ${label(next)}.`)}>
            {text}
          </Button>
        ))}
        <ConfirmAction label="Delete" confirmLabel="Delete plan" busy={busy} onConfirm={() => act(() => apiDelete(`/admin/marketing/strategies/${id}`), 'Plan deleted.', true)} />
      </div>
      {notice ? <div className="mt-3"><Notice tone={notice.tone}>{notice.text}</Notice></div> : null}
    </Panel>
  )
}
