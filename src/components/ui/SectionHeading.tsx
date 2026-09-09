import { cn } from '@/lib/utils'
import { Reveal } from './Reveal'

interface SectionHeadingProps {
  eyebrow?: string
  heading: string
  subtext?: string
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeading({
  eyebrow,
  heading,
  subtext,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      <Reveal>
        {eyebrow ? (
          <span className="mb-3 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-[var(--color-ink)] md:text-4xl">
          {heading}
        </h2>
        {subtext ? (
          <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-[var(--color-ink-muted)]">
            {subtext}
          </p>
        ) : null}
      </Reveal>
    </div>
  )
}
