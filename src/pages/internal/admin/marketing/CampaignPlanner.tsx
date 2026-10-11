import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pagination } from '@/components/internal/Pagination'
import { EmptyState, TableSkeleton } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { fieldInputClass, selectFieldClass } from '@/components/ui/fieldStyles'
import { apiDelete, apiPatch, apiPost } from '@/lib/api'
import { CAMPAIGN_STATUSES, PLATFORM_LABELS, describeFailure, formatDay, label, networkMessage, toDateInput, useResource, type Activity, type Campaign, type CampaignStatus, type PagedOf } from '@/lib/marketing'
import { cn } from '@/lib/utils'
import { ConfirmAction, FormRow, Loading, LoadError, Notice, PageHeader, Panel, Spinner, Tag } from './ui'

const PAGE_SIZE = 10
const STATUS_TONE: Record<CampaignStatus, 'neutral' | 'good' | 'warn'> = { DRAFT: 'neutral', PLANNED: 'warn', ACTIVE: 'good', PAUSED: 'warn', COMPLETED: 'good', ARCHIVED: 'neutral' }

export function CampaignPlanner() {
  const [params, setParams] = useSearchParams()
  const open = params.get('campaign')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (status) query.set('status', status)
  const { data, error, loading, reload } = useResource<PagedOf<'campaigns', Campaign>>(`/admin/marketing/campaigns?${query}`, version)

  const select = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('campaign', id)
    else next.delete('campaign')
    setParams(next)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign planner"
        description="Plan campaigns, schedule activities and track results you enter yourself. These are planning records only: setting a campaign to “Active” starts nothing, publishes nothing and spends nothing, and the budget field is a note — not a connected ad account."
        actions={
          <Button onClick={() => select('new')}>
            <Plus className="h-4 w-4" strokeWidth={1.75} /> New campaign
          </Button>
        }
      />

      {open ? (
        <CampaignEditor
          key={open}
          id={open}
          onClose={() => select(null)}
          onSaved={(id) => {
            setVersion((v) => v + 1)
            if (id) select(id)
          }}
          onDeleted={() => {
            setVersion((v) => v + 1)
            select(null)
          }}
        />
      ) : null}

      <Panel title="Campaigns">
        <div className="mb-4">
          <label>
            <span className="sr-only">Filter by status</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selectFieldClass + ' max-w-xs'}>
              <option value="">All statuses</option>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading && !data ? <TableSkeleton rows={3} columns={4} /> : null}
        {error ? <LoadError message={error} onRetry={reload} /> : null}
        {data && data.campaigns.length === 0 ? <EmptyState message="No campaigns yet — create your first one." /> : null}
        {data && data.campaigns.length > 0 ? (
          <>
            <ul className="space-y-3">
              {data.campaigns.map((c) => {
                const done = c.activities.filter((a) => a.done).length
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => select(c.id)}
                      className={cn('block w-full rounded-[var(--radius-field)] border p-3.5 text-left transition-colors hover:border-white/[0.3]', open === c.id ? 'border-[var(--color-accent)]/50 bg-white/[0.04]' : 'border-white/[0.08] bg-white/[0.02]')}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Tag tone={STATUS_TONE[c.status]}>{label(c.status)}</Tag>
                        {c.channel ? <Tag>{c.channel}</Tag> : null}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-[var(--color-ink-muted)]">{c.objective}</span>
                      <span className="mt-1.5 block text-xs text-[var(--color-ink-faint)]">
                        {c.startDate || c.endDate ? `${formatDay(c.startDate)} → ${formatDay(c.endDate)} · ` : ''}
                        {c.activities.length > 0 ? `${done}/${c.activities.length} activities done` : 'No activities'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        ) : null}
      </Panel>
    </div>
  )
}

interface Form {
  name: string
  objective: string
  audience: string
  market: string
  service: string
  channel: string
  startDate: string
  endDate: string
  budgetAmount: string
  budgetCurrency: string
  successMetrics: string
  status: CampaignStatus
  notes: string
  results: string
  activities: Activity[]
}

const EMPTY: Form = { name: '', objective: '', audience: '', market: '', service: '', channel: '', startDate: '', endDate: '', budgetAmount: '', budgetCurrency: '', successMetrics: '', status: 'DRAFT', notes: '', results: '', activities: [] }

function fromCampaign(c: Campaign): Form {
  return {
    name: c.name,
    objective: c.objective,
    audience: c.audience ?? '',
    market: c.market ?? '',
    service: c.service ?? '',
    channel: c.channel ?? '',
    startDate: toDateInput(c.startDate),
    endDate: toDateInput(c.endDate),
    budgetAmount: c.budgetAmount === null ? '' : String(c.budgetAmount),
    budgetCurrency: c.budgetCurrency ?? '',
    successMetrics: c.successMetrics ?? '',
    status: c.status,
    notes: c.notes ?? '',
    results: c.results ?? '',
    activities: c.activities.map((a) => ({ title: a.title, dueDate: a.dueDate ? a.dueDate.slice(0, 10) : null, done: a.done })),
  }
}

function CampaignEditor({ id, onClose, onSaved, onDeleted }: { id: string; onClose: () => void; onSaved: (id: string | null) => void; onDeleted: () => void }) {
  const isNew = id === 'new'
  const { data, error, loading, reload } = useResource<{ campaign: Campaign }>(isNew ? null : `/admin/marketing/campaigns/${id}`)
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [newActivity, setNewActivity] = useState('')

  useEffect(() => {
    if (data) setForm(fromCampaign(data.campaign))
  }, [data])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const campaign = data?.campaign

  function payload() {
    const orNull = (v: string) => (v.trim() ? v.trim() : null)
    return {
      name: form.name.trim(),
      objective: form.objective.trim(),
      audience: orNull(form.audience),
      market: orNull(form.market),
      service: orNull(form.service),
      channel: orNull(form.channel),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      budgetAmount: form.budgetAmount.trim() === '' ? null : Math.round(Number(form.budgetAmount)),
      budgetCurrency: orNull(form.budgetCurrency),
      activities: form.activities.map((a) => ({ title: a.title, dueDate: a.dueDate || undefined, done: a.done })),
      successMetrics: orNull(form.successMetrics),
      status: form.status,
      notes: orNull(form.notes),
      results: orNull(form.results),
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    setFieldErrors({})
    try {
      const body = payload()
      const res = isNew
        ? await apiPost<{ campaign: Campaign }>('/admin/marketing/campaigns', {
            ...body,
            // Create takes undefined for "none"; null is only meaningful on update.
            audience: body.audience ?? undefined, market: body.market ?? undefined, service: body.service ?? undefined, channel: body.channel ?? undefined,
            startDate: body.startDate ?? undefined, endDate: body.endDate ?? undefined, budgetAmount: body.budgetAmount ?? undefined, budgetCurrency: body.budgetCurrency ?? undefined,
            successMetrics: body.successMetrics ?? undefined, notes: body.notes ?? undefined, results: body.results ?? undefined,
          })
        : await apiPatch<{ campaign: Campaign }>(`/admin/marketing/campaigns/${id}`, body)
      if (res.success) {
        setNotice({ tone: 'ok', text: 'Campaign saved.' })
        onSaved(isNew ? (res.data?.campaign.id ?? null) : null)
        if (!isNew) reload()
      } else {
        setFieldErrors(res.errors ?? {})
        setNotice({ tone: 'error', text: res.message })
      }
    } catch (err) {
      setNotice({ tone: 'error', text: networkMessage(err, 'Failed to save the campaign.') })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      const res = await apiDelete(`/admin/marketing/campaigns/${id}`)
      if (res.success) onDeleted()
      else setNotice({ tone: 'error', text: describeFailure(res) })
    } catch (err) {
      setNotice({ tone: 'error', text: networkMessage(err, 'Failed to delete the campaign.') })
    } finally {
      setBusy(false)
    }
  }

  function addActivity() {
    const title = newActivity.trim()
    if (!title || form.activities.length >= 30) return
    set('activities', [...form.activities, { title, dueDate: null, done: false }])
    setNewActivity('')
  }

  if (!isNew && loading && !data) return <Loading text="Loading campaign…" />
  if (!isNew && (error || !campaign)) return <LoadError message={error ?? 'Campaign not found.'} onRetry={reload} />

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{isNew ? 'New campaign' : 'Edit campaign'}</h3>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="cp-name" label="Name" error={fieldErrors.name}>
            <input id="cp-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={160} className={fieldInputClass} />
          </FormRow>
          <FormRow id="cp-status" label="Status" hint="A label for your own tracking. Changing it starts or stops nothing.">
            <select id="cp-status" value={form.status} onChange={(e) => set('status', e.target.value as CampaignStatus)} className={selectFieldClass}>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
        <FormRow id="cp-objective" label="Objective" error={fieldErrors.objective}>
          <textarea id="cp-objective" value={form.objective} onChange={(e) => set('objective', e.target.value)} rows={2} maxLength={600} className={cn(fieldInputClass, 'resize-y')} />
        </FormRow>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormRow id="cp-audience" label="Audience" optional><input id="cp-audience" value={form.audience} onChange={(e) => set('audience', e.target.value)} maxLength={400} className={fieldInputClass} /></FormRow>
          <FormRow id="cp-market" label="Market" optional><input id="cp-market" value={form.market} onChange={(e) => set('market', e.target.value)} maxLength={300} className={fieldInputClass} /></FormRow>
          <FormRow id="cp-service" label="Service" optional><input id="cp-service" value={form.service} onChange={(e) => set('service', e.target.value)} maxLength={200} className={fieldInputClass} /></FormRow>
          <FormRow id="cp-channel" label="Main channel" optional><input id="cp-channel" value={form.channel} onChange={(e) => set('channel', e.target.value)} maxLength={120} className={fieldInputClass} /></FormRow>
          <FormRow id="cp-start" label="Start date" optional><input id="cp-start" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className={cn(fieldInputClass, '[color-scheme:dark]')} /></FormRow>
          <FormRow id="cp-end" label="End date" optional error={fieldErrors.endDate}><input id="cp-end" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className={cn(fieldInputClass, '[color-scheme:dark]')} /></FormRow>
          <FormRow id="cp-budget" label="Planned budget (note)" optional error={fieldErrors.budgetAmount} hint="Whole number. Not connected to any ad account.">
            <input id="cp-budget" inputMode="numeric" value={form.budgetAmount} onChange={(e) => set('budgetAmount', e.target.value.replace(/[^\d]/g, ''))} className={fieldInputClass} />
          </FormRow>
          <FormRow id="cp-currency" label="Currency" optional error={fieldErrors.budgetCurrency} hint="3 letters, e.g. USD">
            <input id="cp-currency" value={form.budgetCurrency} onChange={(e) => set('budgetCurrency', e.target.value.toUpperCase().slice(0, 3))} className={fieldInputClass} />
          </FormRow>
        </div>
        <FormRow id="cp-metrics" label="How success will be measured" optional>
          <textarea id="cp-metrics" value={form.successMetrics} onChange={(e) => set('successMetrics', e.target.value)} rows={2} maxLength={800} className={cn(fieldInputClass, 'resize-y')} />
        </FormRow>

        <fieldset>
          <legend className="text-sm font-medium">Activities</legend>
          <ul className="mt-2 space-y-2">
            {form.activities.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-field)] border border-white/[0.08] px-3 py-2">
                <input type="checkbox" checked={a.done} onChange={(e) => set('activities', form.activities.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} aria-label={`Mark “${a.title}” done`} className="h-4 w-4 accent-[var(--color-accent)]" />
                <span className={cn('min-w-0 flex-1 text-sm', a.done && 'text-[var(--color-ink-faint)] line-through')}>{a.title}</span>
                <input type="date" value={a.dueDate ?? ''} onChange={(e) => set('activities', form.activities.map((x, j) => (j === i ? { ...x, dueDate: e.target.value || null } : x)))} aria-label={`Due date for “${a.title}”`} className={cn(fieldInputClass, 'w-auto py-1.5 [color-scheme:dark]')} />
                <button type="button" onClick={() => set('activities', form.activities.filter((_, j) => j !== i))} aria-label={`Remove “${a.title}”`} className="text-[var(--color-ink-faint)] hover:text-red-300">
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input value={newActivity} onChange={(e) => setNewActivity(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addActivity() } }} placeholder="Add an activity, e.g. “Publish case-study post”" maxLength={200} aria-label="New activity" className={fieldInputClass} />
            <Button type="button" variant="secondary" onClick={addActivity} disabled={!newActivity.trim() || form.activities.length >= 30}>Add</Button>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="cp-notes" label="Notes" optional><textarea id="cp-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} maxLength={2000} className={cn(fieldInputClass, 'resize-y')} /></FormRow>
          <FormRow id="cp-results" label="Results (entered by you)" optional hint="Only record numbers you have from a real source.">
            <textarea id="cp-results" value={form.results} onChange={(e) => set('results', e.target.value)} rows={3} maxLength={2000} className={cn(fieldInputClass, 'resize-y')} />
          </FormRow>
        </div>

        {campaign?.relatedContent && campaign.relatedContent.length > 0 ? (
          <div>
            <p className="text-sm font-medium">Linked social drafts</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-muted)]">
              {campaign.relatedContent.map((d) => (
                <li key={d.id}>
                  {PLATFORM_LABELS[d.platform]} · {d.title ?? 'Untitled'} · {label(d.status)}
                  {d.plannedFor ? ` · ${formatDay(d.plannedFor)}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy || form.name.trim().length < 2 || form.objective.trim().length < 3}>
            {busy ? <Spinner /> : null} {isNew ? 'Create campaign' : 'Save changes'}
          </Button>
          {!isNew ? <ConfirmAction label="Delete" confirmLabel="Delete campaign" onConfirm={remove} busy={busy} /> : null}
        </div>
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      </form>
    </Panel>
  )
}
