import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'

export function CTASection() {
  return (
    <section className="relative overflow-hidden py-28 md:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_50%,rgba(16,185,129,0.16),transparent)]"
      />
      <div className="container-app relative text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-[var(--color-ink)] md:text-5xl">
            Your next digital advantage starts here.
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-base leading-relaxed text-[var(--color-ink-muted)] md:text-lg">
            Let's build a faster, smarter, and more effective digital presence for your business.
          </p>
          <div className="mt-9">
            <Button href="#contact" size="lg">
              Start a Project
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
