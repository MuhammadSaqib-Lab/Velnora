import { AlertCircle, ArrowRight, Info, Loader2, Search, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/internal/States'
import { Pagination } from '@/components/internal/Pagination'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiGet, apiPost, ApiNetworkError } from '@/lib/api'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { cn } from '@/lib/utils'
import type { LeadFinderLead, NlSearchData, PagedResult } from './types'

const STATUS_OPTIONS = ['NEW', 'RESEARCHED', 'QUALIFIED', 'EMAIL_DRAFTED', 'CONTACTED', 'REPLIED', 'NOT_INTERESTED', 'CONVERTED', 'DISQUALIFIED']
const PRIORITY_OPTIONS = ['EXCELLENT', 'STRONG', 'POTENTIAL', 'LOW']
const OPPORTUNITY_OPTIONS = ['NO_WEBSITE', 'OLD_WEBSITE', 'POOR_MOBILE', 'WEAK_SEO', 'AI_AUTOMATION']
const PAGE_SIZE = 20
const MAX_QUERY_LENGTH = 500

const EXAMPLES = [
  'Find 20 restaurants in Abbottabad with no website',
  'Find dentists in Islamabad with outdated websites',
  'Find 30 businesses in Rawalpindi with weak SEO',
]

/** Minimum-priority tiers the search can honor (LOW is "no minimum"). */
const SEARCH_PRIORITIES = new Set(['EXCELLENT', 'STRONG', 'POTENTIAL'])

type SearchState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; data: NlSearchData }

export function LeadFinderLeads() {
  // Natural-language search (the primary way to start a search).
  const [command, setCommand] = useState('')
  const [searchState, setSearchState] = useState<SearchState>({ phase: 'idle' })
  const [reloadKey, setReloadKey] = useState(0)

  // Saved-leads list filters (unchanged behavior; they also refine the next search).
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [opportunityTypes, setOpportunityTypes] = useState<string[]>([])
  const [hasEmail, setHasEmail] = useState('')
  const [sort, setSort] = useState('score_desc')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult<LeadFinderLead> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => setPage(1), [debouncedSearch, status, priority, opportunityTypes, hasEmail, sort])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)
    if (hasEmail) params.set('hasEmail', hasEmail)
    for (const t of opportunityTypes) params.append('opportunityTypes', t)

    apiGet<PagedResult<LeadFinderLead>>(`/leads?${params}`)
      .then((res) => {
        if (cancelled) return
        if (res.success) setResult(res.data ?? null)
        else setError(res.message)
      })
      .catch((err) => !cancelled && setError(err instanceof ApiNetworkError ? err.message : 'Failed to load leads.'))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, priority, opportunityTypes, hasEmail, sort, page, reloadKey])

  function toggleOpportunity(type: string) {
    setOpportunityTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  /**
   * The browser sends only the sentence and the filter controls; the
   * backend parses, validates, clamps and runs the existing Lead Finder.
   * Selected filters refine the request: "Has email" adds the email
   * requirement, opportunity chips are added to what was asked for, a
   * priority picks a minimum tier, and "Newest first" changes the order.
   */
  async function handleFindLeads(e?: React.FormEvent) {
    e?.preventDefault()
    const query = command.trim()
    if (searchState.phase === 'running') return
    if (query.length < 3) {
      setSearchState({ phase: 'error', message: 'Tell Lead Finder what you need, for example: “Find 20 restaurants in Abbottabad with no website.”' })
      return
    }

    setSearchState({ phase: 'running' })
    try {
      const filters = {
        ...(hasEmail === 'true' ? { hasEmail: true } : {}),
        ...(opportunityTypes.length > 0 ? { opportunityTypes } : {}),
        ...(SEARCH_PRIORITIES.has(priority) ? { minPriority: priority } : {}),
        ...(sort === 'newest' ? { sortBy: 'NEWEST' } : {}),
      }
      const res = await apiPost<NlSearchData>('/leads/nl-search', {
        naturalLanguageQuery: query,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
      })
      if (res.success && res.data) {
        setSearchState({ phase: 'done', data: res.data })
        if (res.data.status === 'completed') setReloadKey((k) => k + 1) // new leads are now in the saved list
      } else if (!res.success) {
        setSearchState({ phase: 'error', message: res.message })
      }
    } catch (err) {
      setSearchState({ phase: 'error', message: err instanceof ApiNetworkError ? err.message : 'Lead search is temporarily unavailable. Please try again.' })
    }
  }

  const running = searchState.phase === 'running'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lead Finder</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Businesses discovered, researched, and scored.</p>
        </div>
        <Link to="/internal/lead-finder" className="text-xs text-[var(--color-ink-faint)] underline hover:text-[var(--color-ink)]">
          Advanced search form →
        </Link>
      </div>

      {/* ───────────── AI lead search ───────────── */}
      <section
        aria-labelledby="ai-lead-search"
        className="mt-5 rounded-[var(--radius-panel)] border border-[var(--color-accent)]/25 bg-[linear-gradient(160deg,rgba(16,185,129,0.07),rgba(255,255,255,0.02))] p-4 sm:p-6"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} aria-hidden="true" />
          <h2 id="ai-lead-search" className="text-base font-semibold">
            AI Lead Search
          </h2>
        </div>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Tell Lead Finder what you need.</p>

        <form onSubmit={(e) => void handleFindLeads(e)} className="mt-4">
          <label htmlFor="lead-command" className="sr-only">
            Describe the businesses you want to find
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <textarea
              id="lead-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleFindLeads()
              }}
              rows={2}
              maxLength={MAX_QUERY_LENGTH}
              disabled={running}
              placeholder="Find 25 restaurants in Abbottabad with no website..."
              className={cn(fieldInputClass, 'min-h-[3.25rem] flex-1 resize-y py-3 text-base leading-snug')}
            />
            <Button type="submit" size="lg" disabled={running} className="shrink-0 justify-center">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  Working…
                </>
              ) : (
                <>
                  Find Leads
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
            Describe the businesses, location, opportunity, and number of leads you want. Up to 20 businesses per search.
          </p>
        </form>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Examples</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => setCommand(example)}
                  className="rounded-full border border-white/[0.12] px-3 py-1.5 text-left text-xs text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)] disabled:opacity-50"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div aria-live="polite" className="mt-4 empty:mt-0">
          {running ? (
            <div className="flex items-start gap-2.5 rounded-[var(--radius-field)] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-[var(--color-ink-muted)]">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--color-accent)]" strokeWidth={2} />
              <span>
                Finding leads — understanding your request, searching, then researching and scoring each business. This can take up to a
                minute.
              </span>
            </div>
          ) : null}

          {searchState.phase === 'error' ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-field)] border border-red-400/25 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>{searchState.message}</span>
            </div>
          ) : null}

          {searchState.phase === 'done' ? <SearchOutcome data={searchState.data} /> : null}
        </div>
      </section>

      {/* ───────────── saved leads + filters (unchanged) ───────────── */}
      <h2 className="mt-8 text-sm font-semibold">Saved leads</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]" strokeWidth={1.75} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter saved leads…"
            aria-label="Filter saved leads"
            className={cn(fieldInputClass, 'pl-10')}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={fieldInputClass}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority" className={fieldInputClass}>
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={fieldInputClass}>
          <option value="score_desc">Highest score</option>
          <option value="priority">Priority</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated_desc">Recently updated</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={hasEmail} onChange={(e) => setHasEmail(e.target.value)} aria-label="Email" className={cn(fieldInputClass, 'w-auto')}>
          <option value="">Email: any</option>
          <option value="true">Has email</option>
          <option value="false">No email</option>
        </select>
        {OPPORTUNITY_OPTIONS.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => toggleOpportunity(type)}
            aria-pressed={opportunityTypes.includes(type)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs',
              opportunityTypes.includes(type)
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                : 'border-white/[0.12] text-[var(--color-ink-faint)]',
            )}
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-ink-faint)]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          These filters narrow the list below and also refine your next AI search: “Has email” requires an email, opportunity types are added to
          the request, a priority sets a minimum, and “Newest first” orders the results.
        </span>
      </p>

      <div className="mt-5">
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : !result || result.leads.length === 0 ? (
          <EmptyState message="No leads match these filters." />
        ) : (
          <>
            <LeadsTable leads={result.leads} />
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}

function SearchOutcome({ data }: { data: NlSearchData }) {
  if (data.status === 'needs_clarification') {
    return (
      <div role="status" className="rounded-[var(--radius-field)] border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
        <p>{data.message}</p>
        {data.understood ? (
          <p className="mt-1.5 text-xs text-amber-200/70">Understood so far: {data.understood.summary}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--radius-field)] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm">
        <p>
          <span className="text-[var(--color-ink-faint)]">Understood: </span>
          <span className="font-medium">{data.understood.summary}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
          {data.stats.found} found · {data.stats.analyzed} researched &amp; scored · {data.stats.matched} matched
          {data.understood.method === 'RULES' ? ' · parsed without AI' : ''}
        </p>
      </div>

      {data.warnings.map((warning) => (
        <p
          key={warning}
          className="flex items-start gap-2 rounded-[var(--radius-field)] border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-xs text-[var(--color-ink-muted)]"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{warning}</span>
        </p>
      ))}

      {data.leads.length === 0 ? (
        <EmptyState message={data.message} />
      ) : (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-accent-soft)]">{data.message}</p>
          <LeadsTable leads={data.leads} />
        </div>
      )}
    </div>
  )
}

function LeadsTable({ leads }: { leads: LeadFinderLead[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-white/[0.08]">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.02] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
            <th className="px-4 py-3">Business</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Opportunities</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <Link to={`/internal/admin/lead-finder/${lead.id}`} className="font-medium underline decoration-white/20">
                  {lead.businessName}
                </Link>
                {lead.location ? <div className="text-xs text-[var(--color-ink-faint)]">{lead.location}</div> : null}
              </td>
              <td className="px-4 py-3 text-[var(--color-ink-muted)]">{lead.category ?? '—'}</td>
              <td className="px-4 py-3">
                <span className="font-medium tabular-nums">{lead.opportunityScore ?? '—'}</span>
                {lead.priority ? (
                  <span className="ml-1.5">
                    <StatusBadge value={lead.priority} />
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                {lead.opportunityTypes.length > 0 ? lead.opportunityTypes.join(', ') : '—'}
              </td>
              <td className="px-4 py-3 text-xs">
                {lead.email ? (
                  <span className="text-[var(--color-ink-muted)]">{lead.email}</span>
                ) : (
                  <span className="text-[var(--color-ink-faint)]">NO_CONTACT_EMAIL</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge value={lead.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
