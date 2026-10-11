import { Download, GitCompare, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pagination } from '@/components/internal/Pagination'
import { EmptyState, TableSkeleton } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { fieldInputClass, selectFieldClass } from '@/components/ui/fieldStyles'
import { apiDelete, apiUrl } from '@/lib/api'
import {
  describeFailure,
  formatWhen,
  label,
  networkMessage,
  useResource,
  useTaskRunner,
  type Audit,
  type ComparisonRow,
  type Finding,
  type FindingLabel,
  type PagedOf,
} from '@/lib/marketing'
import { cn } from '@/lib/utils'
import { ConfirmAction, FormRow, Loading, LoadError, Notice, OutcomeNotice, PageHeader, Panel, Spinner, Tag } from './ui'

const LABEL_INFO: Record<FindingLabel, { title: string; help: string; tone: 'good' | 'accent' | 'warn' | 'neutral' }> = {
  VERIFIED: { title: 'Verified', help: 'Observed directly on the site or returned by Google.', tone: 'good' },
  RECOMMENDATION: { title: 'Recommendation', help: 'Advice based on a verified finding, ranked by impact vs. effort.', tone: 'accent' },
  ESTIMATE: { title: 'Estimate', help: 'A qualitative opportunity. No numbers are invented.', tone: 'warn' },
  UNAVAILABLE: { title: 'Unavailable', help: 'Cannot be known without a connected data source.', tone: 'neutral' },
}
const LABELS: FindingLabel[] = ['VERIFIED', 'RECOMMENDATION', 'ESTIMATE', 'UNAVAILABLE']
const RESULT_TONE = { PASS: 'good', WARN: 'warn', FAIL: 'bad', INFO: 'neutral' } as const
const PAGE_SIZE = 10

export function SeoWorkspace() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('audit')
  const [historyPage, setHistoryPage] = useState(1)
  const [domainFilter, setDomainFilter] = useState('')
  const history = useResource<PagedOf<'audits', Audit>>(`/admin/marketing/seo/audits?page=${historyPage}&pageSize=${PAGE_SIZE}${domainFilter ? `&domain=${encodeURIComponent(domainFilter)}` : ''}`)

  const open = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('audit', id)
    else next.delete('audit')
    setParams(next, { replace: false })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO workspace"
        description="Audit a public website. The audit reads the site the way a visitor or search engine would. It never guesses at rankings, traffic, keyword volumes or backlinks — those need Search Console or a data provider, and are shown as unavailable."
      />

      <AuditForm
        onDone={(id) => {
          history.reload()
          setHistoryPage(1)
          if (id) open(id)
        }}
      />

      {selected ? <AuditReport key={selected} id={selected} onClose={() => open(null)} onDeleted={() => { open(null); history.reload() }} /> : null}

      <Panel title="Audit history" hint="Newest first. Open a report, compare two audits, or delete one.">
        <div className="mb-3 max-w-sm">
          <label htmlFor="seo-domain-filter" className="sr-only">
            Filter by domain
          </label>
          <input
            id="seo-domain-filter"
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value)
              setHistoryPage(1)
            }}
            placeholder="Filter by domain, e.g. example.com"
            className={fieldInputClass}
          />
        </div>
        {history.loading && !history.data ? <TableSkeleton rows={4} columns={4} /> : null}
        {history.error ? <LoadError message={history.error} onRetry={history.reload} /> : null}
        {history.data && history.data.audits.length === 0 ? <EmptyState message="No audits yet — run your first one above." /> : null}
        {history.data && history.data.audits.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Site</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Result</th>
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {history.data.audits.map((audit) => (
                    <tr key={audit.id} className={cn(selected === audit.id && 'bg-white/[0.03]')}>
                      <td className="py-2 pr-3 break-all font-medium">{audit.domain}</td>
                      <td className="py-2 pr-3">{label(audit.kind)}</td>
                      <td className="py-2 pr-3">
                        <span className="flex flex-wrap gap-1.5">
                          <Tag tone="bad">{audit.summary.results?.FAIL ?? 0} fail</Tag>
                          <Tag tone="warn">{audit.summary.results?.WARN ?? 0} warn</Tag>
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-[var(--color-ink-muted)]">{formatWhen(audit.createdAt)}</td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => open(audit.id)} className="text-[var(--color-accent)] underline">
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={history.data.page} pageSize={history.data.pageSize} total={history.data.total} onPageChange={setHistoryPage} />
          </>
        ) : null}
      </Panel>

      {history.data && history.data.audits.length >= 2 ? <ComparePanel audits={history.data.audits} /> : null}

      <SeoPlanForm audits={history.data?.audits ?? []} />
    </div>
  )
}

// ───────────────────────────── run an audit ─────────────────────────────────

function AuditForm({ onDone }: { onDone: (auditId: string | null) => void }) {
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<'OWN' | 'COMPETITOR'>('OWN')
  const [includePageSpeed, setIncludePageSpeed] = useState(true)
  const { run, running, outcome } = useTaskRunner()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const task = await run('/admin/marketing/seo/audits', { url: url.trim(), kind, includePageSpeed })
    if (task) onDone(task.resultIds[0] ?? null)
  }

  return (
    <Panel title="Run an audit" hint="Fetches up to 6 pages and 15 links from the site, with strict limits. Takes up to about 45 seconds.">
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <FormRow id="seo-url" label="Website address" hint="A public site, e.g. velnora.com. Private and internal addresses are refused.">
            <input id="seo-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" inputMode="url" autoComplete="off" className={fieldInputClass} />
          </FormRow>
          <FormRow id="seo-kind" label="This site is">
            <select id="seo-kind" value={kind} onChange={(e) => setKind(e.target.value as 'OWN' | 'COMPETITOR')} className={selectFieldClass}>
              <option value="OWN">Ours / a client’s</option>
              <option value="COMPETITOR">A competitor’s</option>
            </select>
          </FormRow>
        </div>
        {kind === 'COMPETITOR' ? <Notice tone="info">Competitor audits report observable facts only — no recommendations or estimates about someone else’s site.</Notice> : null}
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={includePageSpeed} onChange={(e) => setIncludePageSpeed(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
          <span>
            Include Core Web Vitals from Google PageSpeed Insights
            <span className="block text-xs text-[var(--color-ink-faint)]">If Google doesn’t answer, the audit still completes and says the data is unavailable.</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={running || url.trim().length < 3}>
            {running ? <Spinner /> : <Search className="h-4 w-4" strokeWidth={1.75} />} {running ? 'Auditing…' : 'Run audit'}
          </Button>
        </div>
        <OutcomeNotice outcome={outcome} />
      </form>
    </Panel>
  )
}

// ───────────────────────────── a single report ──────────────────────────────

function AuditReport({ id, onClose, onDeleted }: { id: string; onClose: () => void; onDeleted: () => void }) {
  const { data, error, loading, reload } = useResource<{ audit: Audit }>(`/admin/marketing/seo/audits/${id}`)
  const [tab, setTab] = useState<FindingLabel>('VERIFIED')
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const findings = useMemo(() => data?.audit.findings ?? [], [data])
  const counts = useMemo(() => Object.fromEntries(LABELS.map((l) => [l, findings.filter((f) => f.label === l).length])) as Record<FindingLabel, number>, [findings])
  const shown = useMemo(
    () => findings.filter((f) => f.label === tab && (!onlyProblems || tab !== 'VERIFIED' || f.result === 'FAIL' || f.result === 'WARN')),
    [findings, tab, onlyProblems],
  )

  async function remove() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await apiDelete(`/admin/marketing/seo/audits/${id}`)
      if (res.success) onDeleted()
      else setDeleteError(describeFailure(res))
    } catch (err) {
      setDeleteError(networkMessage(err, 'Failed to delete the audit.'))
    } finally {
      setDeleting(false)
    }
  }

  if (loading && !data) return <Loading text="Loading report…" />
  if (error || !data) return <LoadError message={error ?? 'Report not found.'} onRetry={reload} />
  const { audit } = data
  const sources = audit.summary.dataSources ?? {}

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-all text-base font-semibold">{audit.domain}</h3>
          <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
            {label(audit.kind)} audit · {formatWhen(audit.createdAt)} · {audit.summary.pagesCrawled ?? '?'} pages checked
            {audit.summary.truncated ? ' · time budget reached, some links were not checked' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={apiUrl(`/admin/marketing/seo/audits/${id}/export?format=md`)}
            download
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3.5 py-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} /> Markdown
          </a>
          <a
            href={apiUrl(`/admin/marketing/seo/audits/${id}/export?format=json`)}
            download
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3.5 py-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} /> JSON
          </a>
          <ConfirmAction label="Delete" confirmLabel="Delete audit" onConfirm={remove} busy={deleting} />
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      {deleteError ? <div className="mt-3"><Notice tone="error">{deleteError}</Notice></div> : null}

      <div className="mt-4 rounded-[var(--radius-field)] border border-white/[0.08] p-3 text-xs">
        <p className="font-medium text-[var(--color-ink-muted)]">Data sources for this audit</p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[var(--color-ink-muted)]">
          {Object.entries(sources).map(([key, value]) => (
            <li key={key}>
              {label(key.replace(/([A-Z])/g, ' $1'))}: <span className={value === 'AVAILABLE' ? 'text-[var(--color-accent)]' : ''}>{label(value)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div role="tablist" aria-label="Finding types" className="mt-5 flex flex-wrap gap-1 border-b border-white/[0.08]">
        {LABELS.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={tab === l}
            onClick={() => setTab(l)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              tab === l ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            {LABEL_INFO[l].title} <span className="text-xs text-[var(--color-ink-faint)]">{counts[l]}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--color-ink-faint)]">{LABEL_INFO[tab].help}</p>
      {tab === 'VERIFIED' ? (
        <label className="mt-2 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Show only failures and warnings
        </label>
      ) : null}

      <ul className="mt-4 space-y-3" role="tabpanel">
        {shown.length === 0 ? <li><EmptyState message="Nothing in this group." /></li> : null}
        {shown.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </ul>
    </Panel>
  )
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <li className="rounded-[var(--radius-field)] border border-white/[0.08] bg-white/[0.02] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {finding.result ? <Tag tone={RESULT_TONE[finding.result]}>{finding.result}</Tag> : <Tag tone={LABEL_INFO[finding.label].tone}>{LABEL_INFO[finding.label].title}</Tag>}
        <span className="text-sm font-medium">{finding.title}</span>
        <span className="ml-auto text-xs text-[var(--color-ink-faint)]">{label(finding.category)}</span>
      </div>
      <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{finding.detail}</p>
      {finding.label === 'RECOMMENDATION' ? (
        <p className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-ink-faint)]">
          <span>Impact {finding.impact ?? '?'}/5</span>
          <span>Effort {finding.effort ?? '?'}/5</span>
          <span>Confidence {finding.confidence ? label(finding.confidence) : '?'}</span>
        </p>
      ) : null}
      {finding.pageUrl ? <p className="mt-1.5 break-all text-xs text-[var(--color-ink-faint)]">{finding.pageUrl}</p> : null}
      {finding.evidence ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">Evidence</summary>
          <pre className="mt-1.5 max-h-48 overflow-auto rounded-[var(--radius-field)] bg-black/30 p-2.5 whitespace-pre-wrap break-words text-[var(--color-ink-muted)]">{JSON.stringify(finding.evidence, null, 2)}</pre>
        </details>
      ) : null}
    </li>
  )
}

// ───────────────────────────── comparison ───────────────────────────────────

const CHANGE_TONE = { IMPROVED: 'good', REGRESSED: 'bad', SAME: 'neutral', ONLY_BASE: 'neutral', ONLY_OTHER: 'neutral' } as const

function ComparePanel({ audits }: { audits: Audit[] }) {
  const [base, setBase] = useState('')
  const [other, setOther] = useState('')
  const [showAll, setShowAll] = useState(false)
  const path = base && other && base !== other ? `/admin/marketing/seo/compare?base=${base}&other=${other}` : null
  const { data, error, loading, reload } = useResource<{ base: Audit; other: Audit; sameDomain: boolean; rows: ComparisonRow[] }>(path)

  const options = audits.map((a) => (
    <option key={a.id} value={a.id}>
      {a.domain} — {formatWhen(a.createdAt)}
    </option>
  ))
  const rows = (data?.rows ?? []).filter((r) => showAll || r.change !== 'SAME')

  return (
    <Panel title="Compare two audits" hint="The same site over time, or your site against a competitor. Only verified results are compared.">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow id="cmp-base" label="Baseline">
          <select id="cmp-base" value={base} onChange={(e) => setBase(e.target.value)} className={selectFieldClass}>
            <option value="">Choose an audit…</option>
            {options}
          </select>
        </FormRow>
        <FormRow id="cmp-other" label="Compare with">
          <select id="cmp-other" value={other} onChange={(e) => setOther(e.target.value)} className={selectFieldClass}>
            <option value="">Choose an audit…</option>
            {options}
          </select>
        </FormRow>
      </div>
      {base && other && base === other ? <p className="mt-3 text-sm text-amber-300">Choose two different audits.</p> : null}
      {path && loading ? <Loading text="Comparing…" /> : null}
      {path && error ? <div className="mt-3"><LoadError message={error} onRetry={reload} /></div> : null}
      {path && data ? (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
            <GitCompare className="h-4 w-4" strokeWidth={1.75} />
            {data.sameDomain ? 'Same site, different dates' : `${data.base.domain} vs ${data.other.domain}`}
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
            Include unchanged checks
          </label>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-faint)]">No differences in the verified checks.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Check</th>
                    <th className="py-2 pr-3 font-medium">Baseline</th>
                    <th className="py-2 pr-3 font-medium">Compared</th>
                    <th className="py-2 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {rows.map((row) => (
                    <tr key={row.checkKey}>
                      <td className="py-2 pr-3">{row.title}</td>
                      <td className="py-2 pr-3 text-[var(--color-ink-muted)]">{row.base ?? '—'}</td>
                      <td className="py-2 pr-3 text-[var(--color-ink-muted)]">{row.other ?? '—'}</td>
                      <td className="py-2">
                        <Tag tone={CHANGE_TONE[row.change]}>{label(row.change)}</Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </Panel>
  )
}

// ───────────────────────────── AI SEO plan ──────────────────────────────────

function SeoPlanForm({ audits }: { audits: Audit[] }) {
  const [auditId, setAuditId] = useState('')
  const [niche, setNiche] = useState('')
  const [location, setLocation] = useState('')
  const [focus, setFocus] = useState<'GENERAL' | 'LOCAL' | 'CONTENT'>('GENERAL')
  const [notes, setNotes] = useState('')
  const { run, running, outcome } = useTaskRunner()
  const [planId, setPlanId] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setPlanId(null)
    const body: Record<string, unknown> = { focus }
    if (auditId) body.auditId = auditId
    if (niche.trim()) body.niche = niche.trim()
    if (location.trim()) body.location = location.trim()
    if (notes.trim()) body.notes = notes.trim()
    const task = await run('/admin/marketing/seo/plans', body)
    if (task) setPlanId(task.resultIds[0] ?? null)
  }

  return (
    <Panel title="Create an SEO plan" hint="AI turns a real audit into a prioritized plan. It contains no keyword volumes or traffic forecasts — those aren’t available. Saved under Strategy as a draft.">
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="plan-audit" label="Base it on audit" optional hint="Without one, nothing in the plan is presented as verified.">
            <select id="plan-audit" value={auditId} onChange={(e) => setAuditId(e.target.value)} className={selectFieldClass}>
              <option value="">No audit</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.domain} — {formatWhen(a.createdAt)}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow id="plan-focus" label="Focus">
            <select id="plan-focus" value={focus} onChange={(e) => setFocus(e.target.value as typeof focus)} className={selectFieldClass}>
              <option value="GENERAL">General</option>
              <option value="LOCAL">Local SEO</option>
              <option value="CONTENT">Content</option>
            </select>
          </FormRow>
          <FormRow id="plan-niche" label="Niche or industry" optional>
            <input id="plan-niche" value={niche} onChange={(e) => setNiche(e.target.value)} maxLength={200} className={fieldInputClass} />
          </FormRow>
          <FormRow id="plan-location" label="Location" optional>
            <input id="plan-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} className={fieldInputClass} />
          </FormRow>
        </div>
        <FormRow id="plan-notes" label="Notes" optional>
          <textarea id="plan-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={cn(fieldInputClass, 'resize-y')} />
        </FormRow>
        <Button type="submit" disabled={running}>
          {running ? <Spinner /> : null} {running ? 'Creating plan…' : 'Create plan'}
        </Button>
        <OutcomeNotice outcome={outcome} />
        {planId ? (
          <p className="text-sm">
            <Link to={`/internal/admin/marketing/strategy?open=${planId}`} className="text-[var(--color-accent)] underline">
              Open the plan
            </Link>
          </p>
        ) : null}
      </form>
    </Panel>
  )
}
