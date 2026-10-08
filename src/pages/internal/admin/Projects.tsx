import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProjectStatusBadge } from '@/components/client/ProjectStatus'
import { Pagination } from '@/components/internal/Pagination'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/internal/States'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiGet, ApiNetworkError } from '@/lib/api'
import { formatDate, PROJECT_STATUSES, projectTypeLabel, statusLabel, type AdminProject } from '@/lib/projects'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

const PAGE_SIZE = 20

interface ProjectList {
  projects: AdminProject[]
  total: number
  page: number
  pageSize: number
}

/**
 * Client Portal projects, admin side. The list endpoint is behind the
 * admin session; this is the only place project status can be changed
 * (from the detail page) — clients can only read it.
 */
export function Projects() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ProjectList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => setPage(1), [debouncedSearch, status, sort])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)

    apiGet<ProjectList>(`/admin/projects?${params}`)
      .then((res) => {
        if (cancelled) return
        if (res.success) setResult(res.data ?? null)
        else setError(res.message)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiNetworkError ? err.message : 'Failed to load projects.')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, status, sort, page])

  return (
    <div>
      <h1 className="text-xl font-semibold">Projects</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Projects submitted by clients through the Client Portal. Open one to review it and update its status.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project, client, email, or VEL-1001…"
          aria-label="Search projects"
          className={fieldInputClass}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={fieldInputClass}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={fieldInputClass}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated_desc">Recently updated</option>
        </select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <TableSkeleton columns={5} />
        ) : error ? (
          <ErrorState message={error} />
        ) : !result || result.projects.length === 0 ? (
          <EmptyState message="No projects match these filters." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-white/[0.08]">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {result.projects.map((project) => (
                    <tr key={project.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link to={`/internal/admin/projects/${project.id}`} className="font-medium underline decoration-white/20">
                          {project.projectName}
                        </Link>
                        <div className="font-mono text-xs text-[var(--color-ink-faint)]">{project.projectNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{project.client.name}</div>
                        <div className="text-xs text-[var(--color-ink-faint)]">{project.client.email}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-ink-muted)]">{projectTypeLabel(project.projectType)}</td>
                      <td className="px-4 py-3">
                        <ProjectStatusBadge status={project.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-faint)]">{formatDate(project.createdAt)}</td>
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
