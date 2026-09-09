import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassPanelProps {
  children: ReactNode
  className?: string
}

/**
 * Web approximation of a frosted-glass surface (backdrop-filter + layered
 * borders + highlight), not Apple's native Liquid Glass, which is
 * platform-only. Falls back to a solid fill under prefers-reduced-transparency.
 */
export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'relative rounded-[var(--radius-panel)] border border-white/[0.08]',
        'bg-white/[0.035] backdrop-blur-xl',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        '[@media(prefers-reduced-transparency:reduce)]:bg-zinc-900 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none',
        className,
      )}
    >
      {children}
    </div>
  )
}
