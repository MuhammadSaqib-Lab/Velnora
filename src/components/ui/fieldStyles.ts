import { cn } from '@/lib/utils'

export const fieldInputClass =
  'w-full rounded-[var(--radius-field)] border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)]/60'

/**
 * Native <select> popups are a separate OS/browser-rendered surface, not
 * layered over the page, so a translucent background (fine for text
 * inputs) resolves to a near-white popup. Selects need an opaque
 * background plus an explicit dark color-scheme so both the closed
 * control and the open dropdown render on-theme across browsers.
 */
export const selectFieldClass = cn(
  fieldInputClass,
  'appearance-none bg-[var(--color-surface)] bg-none pr-10 [color-scheme:dark]',
)
