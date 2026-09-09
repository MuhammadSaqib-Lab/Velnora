import { Reveal } from '@/components/ui/Reveal'
import { techStack } from '@/data/techStack'

export function LogoStrip() {
  return (
    <section
      aria-label="Technology we build with"
      className="border-y border-white/[0.06] bg-[var(--color-surface)]/40 py-10"
    >
      <div className="container-app">
        <Reveal>
          <p className="mb-6 text-center text-xs text-[var(--color-ink-faint)]">
            Built on modern, production-grade technology
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {techStack.map((tech) => (
              <img
                key={tech.slug}
                src={`https://cdn.simpleicons.org/${tech.slug}/71717a`}
                alt={tech.name}
                width={28}
                height={28}
                loading="lazy"
                className="h-7 w-7 opacity-70 grayscale transition-opacity duration-200 hover:opacity-100"
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
