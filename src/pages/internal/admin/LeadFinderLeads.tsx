import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/internal/States'
import { Pagination } from '@/components/internal/Pagination'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiGet, ApiNetworkError } from '@/lib/api'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { cn } from '@/lib/utils'
import type { LeadFinderLead, PagedResult } from './types'

const STATUS_OPTIONS = ['NEW', 'RESEARCHED', 'QUALIFIED', 'EMAIL_DRAFTED', 'CONTACTED', 'REPLIED', 'NOT_INTERESTED', 'CONVERTED', 'DISQUALIFIED']
const PRIORITY_OPTIONS = ['EXCELLENT', 'STRONG', 'POTENTIAL', 'LOW']
const OPPORTUNITY_OPTIONS = ['NO_WEBSITE', 'OLD_WEBSITE', 'POOR_MOBILE', 'WEAK_SEO', 'AI_AUTOMATION']
const PAGE_SIZE = 20

export function LeadFinderLeads() {
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
  }, [debouncedSearch, status, priority, opportunityTypes, hasEmail, sort, page])

  function toggleOpportunity(type: string) {
    setOpportunityTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lead Finder</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Businesses discovered, researched, and scored.</p>
        </div>
        <Link
          to="/internal/lead-finder"
          className="text-xs text-[var(--color-ink-faint)] underline hover:text-[var(--color-ink)]"
        >
          Run a new search →
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business, domain, email, location…"
          className={fieldInputClass}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldInputClass}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldInputClass}>
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={fieldInputClass}>
          <option value="score_desc">Highest score</option>
          <option value="priority">Priority</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated_desc">Recently updated</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={hasEmail} onChange={(e) => setHasEmail(e.target.value)} className={cn(fieldInputClass, 'w-auto')}>
          <option value="">Email: any</option>
          <option value="true">Has email</option>
          <option value="false">No email</option>
        </select>
        {OPPORTUNITY_OPTIONS.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => toggleOpportunity(type)}
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

      <div className="mt-6">
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : !result || result.leads.length === 0 ? (
          <EmptyState message="No leads match these filters." />
        ) : (
          <>
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
                  {result.leads.map((lead) => (
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
                        {lead.priority ? <span className="ml-1.5"><StatusBadge value={lead.priority} /></span> : null}
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
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
