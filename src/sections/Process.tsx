import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { processSteps } from '@/data/process'

export function Process() {
  return (
    <section id="process" className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          heading="A clear process from first call to launch"
          subtext="No mystery, no scope creep. Five stages, each with a defined outcome before the next one starts."
        />

        <div className="relative mt-16">
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-6 hidden h-px bg-white/[0.08] lg:block"
          />
          <ol className="grid gap-10 lg:grid-cols-5 lg:gap-6">
            {processSteps.map((step, i) => (
              <Reveal key={step.number} delay={i * 0.08} as="li">
                <div className="relative">
                  <div className="relative z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-canvas)] font-mono text-sm text-[var(--color-accent)]">
                    {step.number}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[var(--color-ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
