import { Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ErrorState } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Outcome } from '@/lib/marketing'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({ title, hint, children, className }: { title?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5', className)}>
      {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
      {hint ? <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{hint}</p> : null}
      <div className={title ? 'mt-3' : undefined}>{children}</div>
    </section>
  )
}

/** Label + control + optional hint/error. The control gets `id` so the label is associated. */
export function FormRow({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? <span className="ml-1 font-normal text-[var(--color-ink-faint)]">(optional)</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-[var(--color-ink-faint)]">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Notice({ tone, children }: { tone: 'ok' | 'error' | 'info' | 'warn'; children: ReactNode }) {
  if (tone === 'error') return <ErrorState message={typeof children === 'string' ? children : 'Something went wrong.'} />
  const styles = {
    ok: 'border-[var(--color-accent)]/25 bg-[var(--color-accent-dim)] text-[var(--color-ink)]',
    info: 'border-white/[0.12] bg-white/[0.03] text-[var(--color-ink-muted)]',
    warn: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-200',
  } as const
  return (
    <div role="status" className={cn('rounded-[var(--radius-panel)] border px-4 py-3 text-sm', styles[tone])}>
      {children}
    </div>
  )
}

export function OutcomeNotice({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return null
  return <Notice tone={outcome.tone}>{outcome.message}</Notice>
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-ink-faint)]" role="status">
      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> {text}
    </div>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <ErrorState message={message} />
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const styles = {
    neutral: 'border-white/[0.12] bg-white/[0.04] text-[var(--color-ink-muted)]',
    good: 'border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
    accent: 'border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
    warn: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    bad: 'border-red-400/25 bg-red-400/10 text-red-300',
  } as const
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', styles[tone])}>{children}</span>
}

export function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
}

/** A destructive action that needs a second, explicit click. */
export function ConfirmAction({ label, confirmLabel = 'Confirm', onConfirm, disabled, busy }: { label: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; disabled?: boolean; busy?: boolean }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <Button variant="ghost" onClick={() => setAsking(true)} disabled={disabled || busy} className="text-red-300 hover:text-red-200">
        {label}
      </Button>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-[var(--color-ink-muted)]">Are you sure?</span>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          await onConfirm()
          setAsking(false)
        }}
        className="border-red-400/40 text-red-300"
      >
        {busy ? <Spinner /> : null}
        {confirmLabel}
      </Button>
      <Button variant="ghost" onClick={() => setAsking(false)} disabled={busy}>
        Cancel
      </Button>
    </span>
  )
}

/** Toggle chips for choosing several values (platforms, categories). */
export function ChipSelect<T extends string>({ options, value, onChange, labelFor, legend }: { options: readonly T[]; value: T[]; onChange: (next: T[]) => void; labelFor: (v: T) => string; legend: string }) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value.includes(option)
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== option) : [...value, option])}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                on ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'border-white/[0.12] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {labelFor(option)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
