import { cn } from '@/lib/utils'

/**
 * Semantic status colors for the admin tool's own tables — not a second
 * marketing accent color (CLAUDE.md's "single accent color" rule is
 * about the public site's brand identity). Kept desaturated/muted to
 * match the site's existing error-state precedent (red-400 in
 * Contact.tsx), not saturated "dashboard template" colors.
 */
const POSITIVE = new Set(['CONVERTED', 'RESOLVED', 'QUALIFIED', 'EXCELLENT', 'HIGH', 'REPLIED'])
const WARNING = new Set(['IN_PROGRESS', 'CONTACTED', 'EMAIL_DRAFTED', 'STRONG', 'MEDIUM', 'RESEARCHED'])
const NEGATIVE = new Set(['DISQUALIFIED', 'NOT_INTERESTED', 'ARCHIVED', 'LOW'])

const STYLES: Record<'positive' | 'warning' | 'negative' | 'neutral', string> = {
  positive: 'border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  negative: 'border-red-400/25 bg-red-400/10 text-red-300',
  neutral: 'border-white/[0.12] bg-white/[0.04] text-[var(--color-ink-muted)]',
}

function toneFor(value: string): keyof typeof STYLES {
  if (POSITIVE.has(value)) return 'positive'
  if (WARNING.has(value)) return 'warning'
  if (NEGATIVE.has(value)) return 'negative'
  return 'neutral'
}

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        STYLES[toneFor(value)],
        className,
      )}
    >
      {value.replace(/_/g, ' ')}
    </span>
  )
}
