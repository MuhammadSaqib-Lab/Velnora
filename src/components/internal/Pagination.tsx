export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-ink-faint)]">
      <p>
        {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-[var(--radius-field)] border border-white/[0.12] px-3 py-1.5 text-[var(--color-ink-muted)] transition-colors hover:border-white/[0.3] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-[var(--radius-field)] border border-white/[0.12] px-3 py-1.5 text-[var(--color-ink-muted)] transition-colors hover:border-white/[0.3] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
