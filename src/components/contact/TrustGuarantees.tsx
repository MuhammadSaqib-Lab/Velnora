import { CheckCircle2, Milestone, ShieldCheck } from 'lucide-react'

const processSteps = [
  'Kickoff call to align on scope',
  'Weekly progress updates',
  'Milestone check-ins before moving forward',
  'Final walkthrough at deployment',
]

const commitments = [
  'No hidden fees, ever',
  'Clear timelines set upfront',
  'Direct communication with your developer',
  'A straightforward, milestone-based workflow',
]

export function TrustGuarantees() {
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-base font-medium text-[var(--color-ink)]">Trust & Guarantees</h3>

      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-dim)]">
          <Milestone className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-ink)]">Transparent process</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            You'll always know where your project stands.
          </p>
          <ol className="mt-3 space-y-2">
            {processSteps.map((step) => (
              <li key={step} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-ink-muted)]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-dim)]">
          <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            Risk-free, clear communication
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            Our commitment for every new client:
          </p>
          <ul className="mt-3 space-y-2">
            {commitments.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  strokeWidth={1.75}
                />
                <span className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
