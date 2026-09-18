import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const RATING_LABELS = ['1 star', '2 stars', '3 stars', '4 stars', '5 stars']
const SIZES = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' } as const

/**
 * Read-only display, e.g. on a review card or the summary header.
 * `role="img"` + a numeric aria-label give screen readers the exact
 * value in one announcement, and the filled-vs-outline star shape
 * (not just a color change) means the rating is never color-only
 * information.
 */
export function StarRatingDisplay({
  rating,
  size = 'md',
  className,
}: {
  rating: number
  size?: keyof typeof SIZES
  className?: string
}) {
  const rounded = Math.round(rating)
  return (
    <div role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5 stars`} className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(
            SIZES[size],
            n <= rounded ? 'fill-[var(--color-accent)] text-[var(--color-accent)]' : 'fill-transparent text-[var(--color-ink-faint)]',
          )}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

/**
 * Interactive star picker for the review submission form. Built as an
 * ARIA radiogroup of five buttons (not five native `<input type="radio">`)
 * so hover-cascade highlighting and keyboard arrow navigation can share
 * one piece of state, while still getting real assistive-tech semantics:
 * `role="radio"`/`aria-checked` per star, one roving tab stop, and arrow
 * keys move both focus and the selected value (the standard ARIA
 * radiogroup pattern).
 */
export function StarRatingInput({
  value,
  onChange,
  id,
  error,
}: {
  value: number
  onChange: (value: number) => void
  id?: string
  error?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const displayValue = hovered ?? value

  function move(current: number, delta: number) {
    const next = Math.min(5, Math.max(1, current + delta))
    onChange(next)
  }

  return (
    <div>
      <div
        id={id}
        role="radiogroup"
        aria-label="Rating"
        aria-required="true"
        aria-invalid={error ? true : undefined}
        className="flex items-center gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={RATING_LABELS[n - 1]}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(value || 0, 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(value || 1, -1)
              }
            }}
            className="rounded-sm p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]"
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                n <= displayValue ? 'fill-[var(--color-accent)] text-[var(--color-accent)]' : 'fill-transparent text-[var(--color-ink-faint)]',
              )}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
