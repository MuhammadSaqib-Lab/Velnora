import { Check, PauseCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isHalted, STAGES, stageIndex, STATUS_DESCRIPTIONS, statusLabel, type ProjectStatus as Status } from '@/lib/projects'

const BADGE_TONES: Record<Status, string> = {
  NEW_REQUEST: 'border-white/[0.14] bg-white/[0.05] text-[var(--color-ink)]',
  REVIEWING: 'border-white/[0.14] bg-white/[0.05] text-[var(--color-ink)]',
  APPROVED: 'border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
  IN_PROGRESS: 'border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
  CLIENT_REVIEW: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  REVISION: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  COMPLETED: 'border-[var(--color-accent)]/40 bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
  ON_HOLD: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  CANCELLED: 'border-red-400/25 bg-red-400/10 text-red-300',
}

/** The project's current status as a pill. Shows the real status — never an invented percentage. */
export function ProjectStatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium',
        BADGE_TONES[status] ?? BADGE_TONES.NEW_REQUEST,
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  )
}

/**
 * The visible journey: Request received → Project reviewed → Development
 * → Client review → Completed. Stepped, not a progress bar — the stages
 * are real states, there is no fabricated "62% done".
 *
 * `reachedIndex` is only needed for ON_HOLD / CANCELLED (which sit
 * outside the journey): it is the furthest stage the project actually
 * reached, derived by the caller from the real status history. Without
 * it (e.g. a list view with no history loaded) a halted project shows
 * only its notice, never a guessed position.
 */
export function StatusTimeline({
  status,
  reachedIndex,
  compact = false,
}: {
  status: Status
  reachedIndex?: number
  compact?: boolean
}) {
  const halted = isHalted(status)
  const current = halted ? (reachedIndex ?? 0) : stageIndex(status)
  const finished = status === 'COMPLETED'

  return (
    <div>
      {halted && reachedIndex === undefined ? null : (
      <ol className="flex flex-col gap-3 sm:flex-row sm:gap-0" aria-label="Project progress">
        {STAGES.map((stage, index) => {
          const done = finished ? true : index < current || (halted && index <= current)
          const isCurrent = !finished && !halted && index === current
          const isLast = index === STAGES.length - 1

          return (
            <li
              key={stage.label}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn('relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:text-center')}
            >
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-[0.8125rem] top-7 h-[calc(100%+0.75rem-1.75rem)] w-px sm:left-[calc(50%+1rem)] sm:top-[0.8125rem] sm:h-px sm:w-[calc(100%-2rem)]',
                    done && index < current ? 'bg-[var(--color-accent)]/60' : finished ? 'bg-[var(--color-accent)]/60' : 'bg-white/[0.1]',
                    halted && 'opacity-50',
                  )}
                />
              ) : null}

              <span
                className={cn(
                  'relative z-10 flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full border text-[0.625rem] font-semibold',
                  done
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-zinc-950'
                    : isCurrent
                      ? 'border-[var(--color-accent)] bg-[var(--color-canvas)] text-[var(--color-accent)] shadow-[0_0_0_4px_rgba(16,185,129,0.15)]'
                      : 'border-white/[0.18] bg-[var(--color-canvas)] text-[var(--color-ink-faint)]',
                  halted && done && 'opacity-50',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : index + 1}
              </span>

              <span
                className={cn(
                  'text-sm',
                  compact && 'sm:text-xs',
                  isCurrent ? 'font-medium text-[var(--color-ink)]' : done ? 'text-[var(--color-ink-muted)]' : 'text-[var(--color-ink-faint)]',
                )}
              >
                {stage.label}
                {isCurrent ? <span className="sr-only"> (current step)</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
      )}

      {halted ? (
        <p
          className={cn(
            'mt-4 flex items-center gap-2 rounded-[var(--radius-field)] border px-3 py-2 text-sm',
            status === 'CANCELLED' ? 'border-red-400/25 bg-red-400/[0.06] text-red-300' : 'border-amber-400/25 bg-amber-400/[0.06] text-amber-300',
          )}
        >
          {status === 'CANCELLED' ? <XCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} /> : <PauseCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
          <span>
            <strong className="font-medium">{statusLabel(status)}.</strong> {STATUS_DESCRIPTIONS[status]}
          </span>
        </p>
      ) : null}
    </div>
  )
}
