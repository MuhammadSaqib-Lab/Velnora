import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
  className,
}: {
  label: string
  value: number | string
  icon?: LucideIcon
  /** Emerald-accented value, for the single most important figure on a card row. */
  accent?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-[var(--color-ink-faint)]" strokeWidth={1.75} /> : null}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums', accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]')}>
        {value}
      </p>
    </div>
  )
}
