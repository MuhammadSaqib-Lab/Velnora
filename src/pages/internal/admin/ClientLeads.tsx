import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/internal/States'
import { Pagination } from '@/components/internal/Pagination'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiGet, ApiNetworkError } from '@/lib/api'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import type { ClientLead, PagedResult } from './types'

const STATUS_OPTIONS = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED']
const INTENT_OPTIONS = ['LOW', 'MEDIUM', 'HIGH']
const PAGE_SIZE = 20

export function ClientLeads() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState('')
  const [intent, setIntent] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult<ClientLead> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => setPage(1), [debouncedSearch, status, intent, sort])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    if (intent) params.set('intent', intent)

    apiGet<PagedResult<ClientLead>>(`/admin/client-leads?${params}`)
      .then((res) => {
        if (cancelled) return
        if (res.success) setResult(res.data ?? null)
        else setError(res.message)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiNetworkError ? err.message : 'Failed to load leads.')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, intent, sort, page])

  return (
    <div>
      <h1 className="text-xl font-semibold">Client Handling Agent Leads</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Leads the AI Consultant captured mid-conversation.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or company…"
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
        <select value={intent} onChange={(e) => setIntent(e.target.value)} className={fieldInputClass}>
          <option value="">All intent levels</option>
          {INTENT_OPTIONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={fieldInputClass}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated_desc">Recently updated</option>
        </select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : !result || result.leads.length === 0 ? (
          <EmptyState message="No client leads match these filters." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-white/[0.08]">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Intent</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {result.leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link to={`/internal/admin/client-leads/${lead.id}`} className="font-medium underline decoration-white/20">
                          {lead.name}
                        </Link>
                        <div className="text-xs text-[var(--color-ink-faint)]">{lead.email}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-ink-muted)]">{lead.company ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-ink-muted)]">{lead.service ?? '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={lead.intent} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={lead.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-faint)]">
                        {new Date(lead.createdAt).toLocaleDateString()}
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
