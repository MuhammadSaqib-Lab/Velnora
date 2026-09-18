import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/internal/States'
import { Pagination } from '@/components/internal/Pagination'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { StarRatingDisplay } from '@/components/ui/StarRating'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiDelete, apiGet, apiPatch, ApiNetworkError } from '@/lib/api'
import type { AdminReview, PagedReviews } from './types'

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED']
const RATING_OPTIONS = [5, 4, 3, 2, 1]
const PAGE_SIZE = 20

export function Reviews() {
  const [status, setStatus] = useState('')
  const [rating, setRating] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedReviews | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => setPage(1), [status, rating, sort])

  function load() {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort })
    if (status) params.set('status', status)
    if (rating) params.set('rating', rating)

    apiGet<PagedReviews>(`/admin/reviews?${params}`)
      .then((res) => {
        if (cancelled) return
        if (res.success) setResult(res.data ?? null)
        else setError(res.message)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiNetworkError ? err.message : 'Failed to load reviews.')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    const cancel = load()
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, rating, sort, page])

  async function handleStatusChange(id: string, next: 'APPROVED' | 'REJECTED') {
    setBusyId(id)
    setMessage(null)
    try {
      const res = await apiPatch<AdminReview>(`/admin/reviews/${id}/status`, { status: next })
      setMessage(res.message)
      if (res.success) load()
    } catch (err) {
      setMessage(err instanceof ApiNetworkError ? err.message : 'Status update failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id)
    setMessage(null)
    try {
      const res = await apiDelete(`/admin/reviews/${id}`)
      setMessage(res.message)
      setConfirmDeleteId(null)
      if (res.success) load()
    } catch (err) {
      setMessage(err instanceof ApiNetworkError ? err.message : 'Delete failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Reviews</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Moderate client reviews — only approved reviews appear on the public site.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldInputClass}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={rating} onChange={(e) => setRating(e.target.value)} className={fieldInputClass}>
          <option value="">All ratings</option>
          {RATING_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r} star{r === 1 ? '' : 's'}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={fieldInputClass}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="rating_desc">Highest rating</option>
          <option value="rating_asc">Lowest rating</option>
        </select>
      </div>

      {message ? <p className="mt-4 text-sm text-[var(--color-accent-soft)]">{message}</p> : null}

      <div className="mt-6">
        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : !result || result.reviews.length === 0 ? (
          <EmptyState message="No reviews match these filters." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-white/[0.08]">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Review</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.reviews.map((review) => (
                    <tr key={review.id} className="border-b border-white/[0.05] last:border-0 align-top hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-ink)]">{review.name}</p>
                        {review.email ? <p className="text-xs text-[var(--color-ink-faint)]">{review.email}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <StarRatingDisplay rating={review.rating} size="sm" />
                      </td>
                      <td className="max-w-xs px-4 py-3 text-[var(--color-ink-muted)]">
                        <p className="line-clamp-3">{review.reviewText}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink-faint)]">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={review.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {review.status !== 'APPROVED' ? (
                            <Button
                              size="md"
                              variant="secondary"
                              disabled={busyId === review.id}
                              onClick={() => void handleStatusChange(review.id, 'APPROVED')}
                              className="px-3 py-1.5 text-xs"
                            >
                              Approve
                            </Button>
                          ) : null}
                          {review.status !== 'REJECTED' ? (
                            <Button
                              size="md"
                              variant="secondary"
                              disabled={busyId === review.id}
                              onClick={() => void handleStatusChange(review.id, 'REJECTED')}
                              className="px-3 py-1.5 text-xs"
                            >
                              Reject
                            </Button>
                          ) : null}
                          {confirmDeleteId === review.id ? (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="md"
                                disabled={busyId === review.id}
                                onClick={() => void handleDelete(review.id)}
                                className="px-3 py-1.5 text-xs"
                              >
                                Confirm delete
                              </Button>
                              <Button
                                size="md"
                                variant="ghost"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(review.id)}
                              className="text-xs text-red-400 underline decoration-red-400/40 hover:text-red-300"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
