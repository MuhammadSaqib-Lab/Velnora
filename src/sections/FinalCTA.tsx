import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'

export function FinalCTA() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-app">
        <Reveal>
          <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-accent)]/40 bg-[linear-gradient(155deg,rgba(16,185,129,0.14),rgba(16,16,19,0.6))] px-6 py-14 text-center shadow-[0_0_60px_-20px_rgba(16,185,129,0.45)] sm:px-12 md:py-20">
            <h2 className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-4xl">
              Ready to build something amazing?
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-base leading-relaxed text-[var(--color-ink-muted)]">
              Tell us about your project and we'll follow up with next steps, no obligation.
            </p>
            <div className="mt-8">
              <Button href="#contact" size="lg">
                Start a Project
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
