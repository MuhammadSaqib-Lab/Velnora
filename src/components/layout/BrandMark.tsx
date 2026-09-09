import { cn } from '@/lib/utils'

interface BrandMarkProps {
  animated?: boolean
  className?: string
}

/**
 * The small diamond brand mark. The navbar version adds a continuously
 * rotating conic-gradient ring for a subtle "live" accent; prefers-reduced-motion
 * freezes it via the global animation override in index.css.
 */
export function BrandMark({ animated = false, className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-flex h-7 w-7 shrink-0 items-center justify-center', className)}
    >
      {animated ? (
        <>
          <span
            className="absolute inset-0 animate-spin-slow rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, var(--color-accent) 0deg, transparent 110deg, transparent 250deg, var(--color-accent) 360deg)',
            }}
          />
          <span className="absolute inset-[3px] rounded-full bg-[var(--color-canvas)]" />
        </>
      ) : null}
      <span className="relative h-2.5 w-2.5 rotate-45 rounded-[3px] bg-[var(--color-accent)]" />
    </span>
  )
}
