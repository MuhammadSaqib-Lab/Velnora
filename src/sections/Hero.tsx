import { ArrowRight, Compass } from 'lucide-react'
import { useReducedMotion, motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { HeroVisual } from '@/components/three/HeroVisual'

export function Hero() {
  const reduce = useReducedMotion()

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
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] px-4 py-1.5 shadow-[0_0_24px_-6px_rgba(16,185,129,0.55)]">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            </span>
            <span className="text-xs font-medium text-[var(--color-accent-soft)]">
              Currently accepting Q3 projects
            </span>
          </div>

          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
            We build digital experiences that grow businesses.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[var(--color-ink-muted)]">
            AI-powered websites, high-performance development, and SEO strategies designed to
            turn visitors into customers.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button href="#contact" size="lg">
              Start a Project
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button href="#work" variant="secondary" size="lg">
              <Compass className="h-4 w-4" strokeWidth={1.75} />
              Explore Our Work
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-md lg:max-w-none"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  )
}
