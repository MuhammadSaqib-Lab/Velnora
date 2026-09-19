import { ArrowRight, Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { HeroVisual } from '@/components/three/HeroVisual'
import { availabilityStatus } from '@/data/availability'

export function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[100dvh] items-center overflow-hidden pt-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(16,185,129,0.14),transparent)]"
      />

      <div className="container-app grid items-center gap-12 py-10 sm:gap-16 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:py-20">
        <div className="animate-hero-fade-up">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-4 py-1.5 shadow-[0_0_24px_-6px_rgba(16,185,129,0.55)]">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            </span>
            <span className="text-xs font-medium text-[var(--color-accent-soft)]">
              {availabilityStatus}
            </span>
          </div>

          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
            We engineer digital experiences that grow businesses.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[var(--color-ink-muted)]">
            Custom front-end architecture and high-performance builds designed to turn visitors
            into customers.
          </p>

          <div className="mt-9 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
            <Button href="#contact" size="lg" className="w-full justify-center md:w-auto md:justify-start">
              Start a Project
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button
              href="#work"
              variant="secondary"
              size="lg"
              className="w-full justify-center md:w-auto md:justify-start"
            >
              <Compass className="h-4 w-4" strokeWidth={1.75} />
              Explore Our Work
            </Button>
          </div>
        </div>

        <div className="animate-hero-scale-in mx-auto w-full max-w-[280px] md:max-w-md lg:max-w-none">
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}
