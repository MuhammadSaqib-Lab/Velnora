import { AlertCircle, Inbox } from 'lucide-react'

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-white/[0.12] px-6 py-12 text-center">
      <Inbox className="h-5 w-5 text-[var(--color-ink-faint)]" strokeWidth={1.5} />
      <p className="text-sm text-[var(--color-ink-faint)]">{message}</p>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-panel)] border border-red-400/25 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span>{message}</span>
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }, (_, col) => (
            <div key={col} className="h-8 flex-1 rounded-[var(--radius-field)] bg-white/[0.04]" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-20 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.03]" />
      ))}
    </div>
  )
}
