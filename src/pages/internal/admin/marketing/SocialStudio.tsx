import { CalendarDays, Copy, Plus, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pagination } from '@/components/internal/Pagination'
import { EmptyState, TableSkeleton } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { fieldInputClass, selectFieldClass } from '@/components/ui/fieldStyles'
import { apiDelete, apiPatch, apiPost } from '@/lib/api'
import {
  CONTENT_STATUSES,
  CONTENT_TYPES,
  DRAFT_TRANSITIONS,
  PLATFORMS,
  PLATFORM_LABELS,
  describeFailure,
  formatDay,
  formatWhen,
  label,
  networkMessage,
  toDateInput,
  useResource,
  useTaskRunner,
  type ContentStatus,
  type ContentType,
  type Draft,
  type DraftRevision,
  type PagedOf,
  type Platform,
} from '@/lib/marketing'
import { cn } from '@/lib/utils'
import { ChipSelect, ConfirmAction, FormRow, Loading, LoadError, Notice, OutcomeNotice, PageHeader, Panel, Spinner, Tag } from './ui'

type Mode = 'drafts' | 'generate' | 'calendar'
const PAGE_SIZE = 12
const STATUS_TONE: Record<ContentStatus, 'neutral' | 'warn' | 'good' | 'bad'> = { DRAFT: 'neutral', IN_REVIEW: 'warn', APPROVED: 'good', REJECTED: 'bad', ARCHIVED: 'neutral' }

const parseHashtags = (text: string): string[] =>
  [...new Set(text.split(/[\s,]+/).map((t) => t.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean))].slice(0, 30).map((t) => `#${t}`)

export function SocialStudio() {
  const [params, setParams] = useSearchParams()
  const mode = (params.get('view') as Mode | null) ?? 'drafts'
  const selected = params.get('draft')
  const [refreshKey, setRefreshKey] = useState(0)

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next)
  }
  const bump = () => setRefreshKey((n) => n + 1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social media studio"
        description="Create, edit and review drafts for LinkedIn, Instagram, Facebook, TikTok, X and YouTube. Nothing is posted: “approved” and a planned date are records for you — publish manually on each platform."
      />

      <div role="tablist" aria-label="Social studio views" className="flex gap-1 border-b border-white/[0.08]">
        {(
          [
            ['drafts', 'Drafts'],
            ['generate', 'Create content'],
            ['calendar', 'Calendar'],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => update({ view: key === 'drafts' ? null : key })}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors',
              mode === key ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            {text}
          </button>
        ))}
      </div>

      {mode === 'generate' ? (
        <div className="space-y-6">
          <GenerateForm onDone={() => { bump(); update({ view: null }) }} />
          <CalendarGenerateForm onDone={() => { bump(); update({ view: 'calendar' }) }} />
          <ManualDraftForm onCreated={(id) => { bump(); update({ view: null, draft: id }) }} />
        </div>
      ) : null}

      {mode === 'calendar' ? <CalendarView key={refreshKey} onOpen={(id) => update({ view: null, draft: id })} /> : null}

      {mode === 'drafts' ? (
        <>
          {selected ? (
            <DraftEditor
              key={selected}
              id={selected}
              onClose={() => update({ draft: null })}
              onChanged={bump}
              onOpen={(id) => update({ draft: id })}
            />
          ) : null}
          <DraftList key={refreshKey} selected={selected} onOpen={(id) => update({ draft: id })} />
        </>
      ) : null}
    </div>
  )
}

// ──────────────────────────────── list ──────────────────────────────────────

function DraftList({ selected, onOpen }: { selected: string | null; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState('')
  const [platform, setPlatform] = useState('')
  const [page, setPage] = useState(1)
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (status) query.set('status', status)
  if (platform) query.set('platform', platform)
  const { data, error, loading, reload } = useResource<PagedOf<'drafts', Draft>>(`/admin/marketing/social/drafts?${query}`)

  return (
    <Panel title="Drafts">
      <div className="mb-4 flex flex-wrap gap-3">
        <label>
          <span className="sr-only">Filter by status</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selectFieldClass}>
            <option value="">All statuses</option>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by platform</span>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1) }} className={selectFieldClass}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading && !data ? <TableSkeleton rows={4} columns={4} /> : null}
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {data && data.drafts.length === 0 ? <EmptyState message="No drafts match. Use “Create content” to generate or write one." /> : null}
      {data && data.drafts.length > 0 ? (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.drafts.map((draft) => (
              <li key={draft.id}>
                <button
                  type="button"
                  onClick={() => onOpen(draft.id)}
                  aria-current={selected === draft.id}
                  className={cn(
                    'block w-full rounded-[var(--radius-field)] border p-3.5 text-left transition-colors hover:border-white/[0.3]',
                    selected === draft.id ? 'border-[var(--color-accent)]/50 bg-white/[0.04]' : 'border-white/[0.08] bg-white/[0.02]',
                  )}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{PLATFORM_LABELS[draft.platform]}</span>
                    <Tag tone={STATUS_TONE[draft.status]}>{label(draft.status)}</Tag>
                    {draft.origin === 'AI' ? <Tag>AI draft</Tag> : null}
                  </span>
                  <span className="mt-1.5 line-clamp-3 block text-sm text-[var(--color-ink-muted)]">{draft.title ? `${draft.title} — ` : ''}{draft.body}</span>
                  <span className="mt-2 block text-xs text-[var(--color-ink-faint)]">
                    {draft.plannedFor ? `Planned ${formatDay(draft.plannedFor)} · ` : ''}Updated {formatWhen(draft.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      ) : null}
    </Panel>
  )
}

// ──────────────────────────────── editor ────────────────────────────────────

function DraftEditor({ id, onClose, onChanged, onOpen }: { id: string; onClose: () => void; onChanged: () => void; onOpen: (id: string) => void }) {
  const { data, error, loading, reload } = useResource<{ draft: Draft }>(`/admin/marketing/social/drafts/${id}`)
  const revisions = useResource<{ revisions: DraftRevision[] }>(`/admin/marketing/social/drafts/${id}/revisions`)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [cta, setCta] = useState('')
  const [notes, setNotes] = useState('')
  const [plannedFor, setPlannedFor] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [instruction, setInstruction] = useState('')
  const [repurposeTo, setRepurposeTo] = useState<Platform[]>([])
  const regenerate = useTaskRunner()
  const repurpose = useTaskRunner()

  const draft = data?.draft
  useEffect(() => {
    if (!draft) return
    setTitle(draft.title ?? '')
    setBody(draft.body)
    setHashtags(draft.hashtags.join(' '))
    setCta(draft.callToAction ?? '')
    setNotes(draft.notes ?? '')
    setPlannedFor(toDateInput(draft.plannedFor))
  }, [draft])

  const dirty = useMemo(
    () =>
      !!draft &&
      (title !== (draft.title ?? '') || body !== draft.body || hashtags.trim() !== draft.hashtags.join(' ') || cta !== (draft.callToAction ?? '') || notes !== (draft.notes ?? '') || plannedFor !== toDateInput(draft.plannedFor)),
    [draft, title, body, hashtags, cta, notes, plannedFor],
  )

  async function call(fn: () => Promise<{ success: boolean; message: string; errors?: Record<string, string> }>, okText: string, after?: () => void) {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fn()
      if (res.success) {
        setNotice({ tone: 'ok', text: okText })
        reload()
        revisions.reload()
        onChanged()
        after?.()
      } else setNotice({ tone: 'error', text: describeFailure(res) })
    } catch (err) {
      setNotice({ tone: 'error', text: networkMessage(err, 'The request failed.') })
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    call(
      () =>
        apiPatch(`/admin/marketing/social/drafts/${id}`, {
          title: title.trim() || null,
          body,
          hashtags: parseHashtags(hashtags),
          callToAction: cta.trim() || null,
          notes: notes.trim() || null,
          plannedFor: plannedFor || null,
        }),
      draft?.status === 'APPROVED' ? 'Saved. Editing the text sent this draft back to Draft — it needs approval again.' : 'Saved.',
    )
  const setStatus = (status: ContentStatus) => call(() => apiPost(`/admin/marketing/social/drafts/${id}/status`, { status }), `Status changed to ${label(status)}.`)
  const duplicate = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await apiPost<{ draft: Draft }>(`/admin/marketing/social/drafts/${id}/duplicate`, {})
      if (res.success && res.data) {
        onChanged()
        onOpen(res.data.draft.id)
      } else if (!res.success) setNotice({ tone: 'error', text: describeFailure(res) })
    } catch (err) {
      setNotice({ tone: 'error', text: networkMessage(err, 'The request failed.') })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      const res = await apiDelete(`/admin/marketing/social/drafts/${id}`)
      if (res.success) {
        onChanged()
        onClose()
      } else setNotice({ tone: 'error', text: describeFailure(res) })
    } catch (err) {
      setNotice({ tone: 'error', text: networkMessage(err, 'The request failed.') })
    } finally {
      setBusy(false)
    }
  }
  async function doRegenerate() {
    const task = await regenerate.run(`/admin/marketing/social/drafts/${id}/regenerate`, instruction.trim() ? { instruction: instruction.trim() } : {})
    if (task) {
      reload()
      revisions.reload()
      onChanged()
    }
  }
  async function doRepurpose() {
    const task = await repurpose.run('/admin/marketing/social/repurpose', { sourceDraftId: id, platforms: repurposeTo })
    if (task) {
      onChanged()
      setRepurposeTo([])
    }
  }

  if (loading && !data) return <Loading text="Loading draft…" />
  if (error || !draft) return <LoadError message={error ?? 'Draft not found.'} onRetry={reload} />
  const transitions = DRAFT_TRANSITIONS[draft.status]
  const locked = busy

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{PLATFORM_LABELS[draft.platform]} draft</h3>
          <Tag tone={STATUS_TONE[draft.status]}>{label(draft.status)}</Tag>
          <Tag>{label(draft.contentType)}</Tag>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
        {draft.origin === 'AI' ? 'AI-generated — review every fact before using it.' : 'Written by hand.'} · Created by {draft.createdBy} · Updated {formatWhen(draft.updatedAt)}
        {draft.approvedBy ? ` · Approved by ${draft.approvedBy} ${formatWhen(draft.approvedAt)}` : ''}
      </p>

      {draft.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {draft.warnings.map((w) => (
            <li key={w}><Notice tone="warn">{w}</Notice></li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-4">
        <FormRow id="d-title" label="Title / hook" optional>
          <input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={fieldInputClass} />
        </FormRow>
        <FormRow id="d-body" label="Content" hint={`${body.length.toLocaleString()} characters`}>
          <textarea id="d-body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={10000} className={cn(fieldInputClass, 'resize-y leading-relaxed')} />
        </FormRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="d-tags" label="Hashtags" optional hint="Separated by spaces or commas">
            <input id="d-tags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={fieldInputClass} />
          </FormRow>
          <FormRow id="d-cta" label="Call to action" optional>
            <input id="d-cta" value={cta} onChange={(e) => setCta(e.target.value)} maxLength={300} className={fieldInputClass} />
          </FormRow>
          <FormRow id="d-date" label="Planned date" optional hint="A reminder for you. Nothing is published on this date.">
            <input id="d-date" type="date" value={plannedFor} onChange={(e) => setPlannedFor(e.target.value)} className={cn(fieldInputClass, '[color-scheme:dark]')} />
          </FormRow>
          <FormRow id="d-notes" label="Reviewer notes" optional>
            <input id="d-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className={fieldInputClass} />
          </FormRow>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={!dirty || locked || body.trim().length === 0}>
          {locked ? <Spinner /> : null} Save changes
        </Button>
        {transitions.map((next) => (
          <Button key={next} variant="secondary" onClick={() => void setStatus(next)} disabled={locked || dirty} title={dirty ? 'Save your edits first' : undefined}>
            {next === 'IN_REVIEW' ? 'Send to review' : next === 'APPROVED' ? 'Approve' : next === 'REJECTED' ? 'Reject' : next === 'ARCHIVED' ? 'Archive' : 'Back to draft'}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => void duplicate()} disabled={locked}>
          <Copy className="h-4 w-4" strokeWidth={1.75} /> Duplicate
        </Button>
        <ConfirmAction label="Delete" confirmLabel="Delete draft" onConfirm={remove} busy={locked} />
      </div>
      {notice ? <div className="mt-3"><Notice tone={notice.tone}>{notice.text}</Notice></div> : null}

      <div className="mt-6 grid gap-4 border-t border-white/[0.08] pt-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Regenerate with AI</h4>
          <FormRow id="d-instruction" label="What should change?" optional hint="E.g. “shorter, more direct”. The current text is kept in revision history.">
            <input id="d-instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={400} className={fieldInputClass} />
          </FormRow>
          <Button variant="secondary" onClick={() => void doRegenerate()} disabled={regenerate.running || locked || dirty} title={dirty ? 'Save your edits first' : undefined}>
            {regenerate.running ? <Spinner /> : <Sparkles className="h-4 w-4" strokeWidth={1.75} />} Regenerate
          </Button>
          <OutcomeNotice outcome={regenerate.outcome} />
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Repurpose for other platforms</h4>
          <ChipSelect options={PLATFORMS.filter((p) => p !== draft.platform)} value={repurposeTo} onChange={setRepurposeTo} labelFor={(p) => PLATFORM_LABELS[p]} legend="Platforms to repurpose to" />
          <Button variant="secondary" onClick={() => void doRepurpose()} disabled={repurpose.running || repurposeTo.length === 0 || dirty} title={dirty ? 'Save your edits first' : undefined}>
            {repurpose.running ? <Spinner /> : null} Create versions
          </Button>
          <OutcomeNotice outcome={repurpose.outcome} />
        </div>
      </div>

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">Revision history ({revisions.data?.revisions.length ?? 0})</summary>
        <ul className="mt-3 space-y-3">
          {(revisions.data?.revisions ?? []).map((rev) => (
            <li key={rev.id} className="rounded-[var(--radius-field)] border border-white/[0.08] p-3">
              <p className="text-xs text-[var(--color-ink-faint)]">
                {formatWhen(rev.createdAt)} · {rev.editedBy} · {label(rev.source)}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--color-ink-muted)]">{rev.body}</p>
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  )
}

// ─────────────────────────────── generators ─────────────────────────────────

function GenerateForm({ onDone }: { onDone: () => void }) {
  const [platforms, setPlatforms] = useState<Platform[]>(['LINKEDIN'])
  const [contentType, setContentType] = useState<ContentType>('POST')
  const [objective, setObjective] = useState('')
  const [audience, setAudience] = useState('')
  const [topic, setTopic] = useState('')
  const [cta, setCta] = useState('')
  const [facts, setFacts] = useState('')
  const [count, setCount] = useState(2)
  const { run, running, outcome } = useTaskRunner()
  const total = platforms.length * count
  const caseStudyNeedsFacts = contentType === 'CASE_STUDY' && facts.trim().length < 50

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = { platforms, contentType, objective: objective.trim(), audience: audience.trim(), countPerPlatform: count }
    if (topic.trim()) body.topic = topic.trim()
    if (cta.trim()) body.callToAction = cta.trim()
    if (facts.trim()) body.verifiedFacts = facts.trim()
    if (await run('/admin/marketing/social/generate', body)) onDone()
  }

  return (
    <Panel title="Generate drafts with AI" hint="Creates drafts for you to review and edit. They’re saved as Draft and never posted.">
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <div>
          <p className="mb-2 text-sm font-medium">Platforms</p>
          <ChipSelect options={PLATFORMS} value={platforms} onChange={setPlatforms} labelFor={(p) => PLATFORM_LABELS[p]} legend="Platforms" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="g-type" label="Content type">
            <select id="g-type" value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)} className={selectFieldClass}>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow id="g-count" label="Drafts per platform" hint={`${total} draft${total === 1 ? '' : 's'} in total (max 12)`}>
            <input id="g-count" type="number" min={1} max={5} value={count} onChange={(e) => setCount(Math.min(5, Math.max(1, Number(e.target.value) || 1)))} className={fieldInputClass} />
          </FormRow>
          <FormRow id="g-objective" label="Goal of the content" hint="E.g. “Get small businesses to book a free website review”">
            <input id="g-objective" value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={300} className={fieldInputClass} />
          </FormRow>
          <FormRow id="g-audience" label="Audience" hint="E.g. “Clinic owners in Lahore”">
            <input id="g-audience" value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={300} className={fieldInputClass} />
          </FormRow>
          <FormRow id="g-topic" label="Topic" optional>
            <input id="g-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={400} className={fieldInputClass} />
          </FormRow>
          <FormRow id="g-cta" label="Call to action" optional>
            <input id="g-cta" value={cta} onChange={(e) => setCta(e.target.value)} maxLength={200} className={fieldInputClass} />
          </FormRow>
        </div>
        <FormRow
          id="g-facts"
          label="Verified facts"
          optional={contentType !== 'CASE_STUDY'}
          hint={contentType === 'CASE_STUDY' ? 'Required for a case study: it can only use facts you provide here (at least 50 characters). Nothing is invented.' : 'Facts you vouch for. The AI will not add statistics, clients or results of its own.'}
          error={caseStudyNeedsFacts && facts.length > 0 ? 'Add more verified detail (at least 50 characters).' : undefined}
        >
          <textarea id="g-facts" value={facts} onChange={(e) => setFacts(e.target.value)} rows={3} maxLength={3000} className={cn(fieldInputClass, 'resize-y')} />
        </FormRow>
        <Button type="submit" disabled={running || platforms.length === 0 || total > 12 || objective.trim().length < 3 || audience.trim().length < 3 || caseStudyNeedsFacts}>
          {running ? <Spinner /> : <Sparkles className="h-4 w-4" strokeWidth={1.75} />} {running ? 'Generating…' : 'Generate drafts'}
        </Button>
        <OutcomeNotice outcome={outcome} />
      </form>
    </Panel>
  )
}

function CalendarGenerateForm({ onDone }: { onDone: () => void }) {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [platforms, setPlatforms] = useState<Platform[]>(['LINKEDIN'])
  const [perWeek, setPerWeek] = useState(2)
  const [objective, setObjective] = useState('')
  const [audience, setAudience] = useState('')
  const [themes, setThemes] = useState('')
  const { run, running, outcome } = useTaskRunner()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = { month, platforms, postsPerWeek: perWeek, objective: objective.trim(), audience: audience.trim() }
    if (themes.trim()) body.themes = themes.trim()
    if (await run('/admin/marketing/social/calendar', body)) onDone()
  }

  return (
    <Panel title="Plan a month" hint="Generates a month of draft ideas with suggested dates. They are unapproved drafts, and the dates are suggestions only.">
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <ChipSelect options={PLATFORMS} value={platforms} onChange={setPlatforms} labelFor={(p) => PLATFORM_LABELS[p]} legend="Platforms for the calendar" />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormRow id="c-month" label="Month">
            <input id="c-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={cn(fieldInputClass, '[color-scheme:dark]')} />
          </FormRow>
          <FormRow id="c-per" label="Posts per week">
            <input id="c-per" type="number" min={1} max={5} value={perWeek} onChange={(e) => setPerWeek(Math.min(5, Math.max(1, Number(e.target.value) || 1)))} className={fieldInputClass} />
          </FormRow>
          <FormRow id="c-themes" label="Themes" optional>
            <input id="c-themes" value={themes} onChange={(e) => setThemes(e.target.value)} maxLength={600} className={fieldInputClass} />
          </FormRow>
          <FormRow id="c-objective" label="Goal">
            <input id="c-objective" value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={300} className={fieldInputClass} />
          </FormRow>
          <FormRow id="c-audience" label="Audience">
            <input id="c-audience" value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={300} className={fieldInputClass} />
          </FormRow>
        </div>
        <Button type="submit" disabled={running || platforms.length === 0 || !month || objective.trim().length < 3 || audience.trim().length < 3}>
          {running ? <Spinner /> : <CalendarDays className="h-4 w-4" strokeWidth={1.75} />} {running ? 'Planning…' : 'Plan the month'}
        </Button>
        <OutcomeNotice outcome={outcome} />
      </form>
    </Panel>
  )
}

function ManualDraftForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [platform, setPlatform] = useState<Platform>('LINKEDIN')
  const [contentType, setContentType] = useState<ContentType>('POST')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await apiPost<{ draft: Draft }>('/admin/marketing/social/drafts', { platform, contentType, body })
      if (res.success && res.data) onCreated(res.data.draft.id)
      else if (!res.success) setError(describeFailure(res))
    } catch (err) {
      setError(networkMessage(err, 'Failed to save the draft.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Write a draft yourself" hint="No AI needed. Saved as a Draft you can edit and send for review.">
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="m-platform" label="Platform">
            <select id="m-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={selectFieldClass}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow id="m-type" label="Content type">
            <select id="m-type" value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)} className={selectFieldClass}>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
        <FormRow id="m-body" label="Content">
          <textarea id="m-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={10000} className={cn(fieldInputClass, 'resize-y')} />
        </FormRow>
        <Button type="submit" variant="secondary" disabled={busy || body.trim().length === 0}>
          {busy ? <Spinner /> : <Plus className="h-4 w-4" strokeWidth={1.75} />} Save draft
        </Button>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </Panel>
  )
}

// ─────────────────────────────── calendar ───────────────────────────────────

function CalendarView({ onOpen }: { onOpen: (id: string) => void }) {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const { data, error, loading, reload } = useResource<{ month: string; items: Draft[]; unscheduled: number }>(`/admin/marketing/social/calendar?month=${month}`)

  const [year, mon] = month.split('-').map(Number) as [number, number]
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const leading = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7 // Monday-first
  const byDay = new Map<number, Draft[]>()
  for (const item of data?.items ?? []) {
    const day = new Date(item.plannedFor!).getUTCDate()
    byDay.set(day, [...(byDay.get(day) ?? []), item])
  }
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, mon - 1 + delta, 1))
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => shift(-1)} aria-label="Previous month">Previous</Button>
          <Button variant="secondary" onClick={() => shift(1)} aria-label="Next month">Next</Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
        Planned dates are reminders. Nothing is published automatically.
        {data ? ` ${data.unscheduled} draft${data.unscheduled === 1 ? '' : 's'} have no date yet.` : ''}
      </p>
      {loading && !data ? <Loading text="Loading calendar…" /> : null}
      {error ? <div className="mt-3"><LoadError message={error} onRetry={reload} /></div> : null}
      {data ? (
        <>
          <div className="mt-4 hidden grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-field)] border border-white/[0.08] bg-white/[0.08] md:grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="bg-[var(--color-canvas)] px-2 py-1.5 text-xs font-medium text-[var(--color-ink-faint)]">{d}</div>
            ))}
            {Array.from({ length: leading }, (_, i) => (
              <div key={`pad-${i}`} className="min-h-24 bg-[var(--color-canvas)]" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
              <div key={day} className="min-h-24 bg-[var(--color-canvas)] p-1.5">
                <p className="text-xs text-[var(--color-ink-faint)]">{day}</p>
                <ul className="mt-1 space-y-1">
                  {(byDay.get(day) ?? []).map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => onOpen(item.id)} className="w-full truncate rounded bg-white/[0.06] px-1.5 py-1 text-left text-[11px] hover:bg-white/[0.12]" title={item.body}>
                        {PLATFORM_LABELS[item.platform]}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* Phones: a plain agenda list reads better than a 7-column grid. */}
          <ul className="mt-4 space-y-2 md:hidden">
            {data.items.length === 0 ? <li><EmptyState message="Nothing planned this month." /></li> : null}
            {data.items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onOpen(item.id)} className="block w-full rounded-[var(--radius-field)] border border-white/[0.08] p-3 text-left">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {formatDay(item.plannedFor)} · {PLATFORM_LABELS[item.platform]} <Tag tone={STATUS_TONE[item.status]}>{label(item.status)}</Tag>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm text-[var(--color-ink-muted)]">{item.body}</span>
                </button>
              </li>
            ))}
          </ul>
          {data.items.length === 0 ? <p className="mt-4 hidden text-sm text-[var(--color-ink-faint)] md:block">Nothing is planned this month. Generate a calendar from “Create content”, or set a planned date on a draft.</p> : null}
        </>
      ) : null}
    </Panel>
  )
}
