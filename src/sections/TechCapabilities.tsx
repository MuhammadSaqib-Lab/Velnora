import { SectionHeading } from '@/components/ui/SectionHeading'
import { capabilities, type CapabilityBadge } from '@/data/capabilities'

function Badge({ tech }: { tech: CapabilityBadge }) {
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] px-6 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-accent)]/40 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)]">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent-dim)]">
        <img
          src={`https://cdn.simpleicons.org/${tech.slug}/a1a1aa`}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          className="h-5 w-5"
        />
      </span>
      <span className="whitespace-nowrap text-sm font-medium text-[var(--color-ink)]">
        {tech.name}
      </span>
    </div>
  )
}

export function TechCapabilities() {
  return (
    <section className="relative py-20 md:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_40%,rgba(16,185,129,0.08),transparent)]"
      />

      <div className="container-app relative">
        <SectionHeading
          heading="Technologies we build client projects with"
          subtext="Chosen for performance, maintainability, and how well they scale as a project grows."
          align="center"
        />
      </div>

      <div className="relative mt-12 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <ul
          className="flex w-max list-none gap-4 animate-marquee"
          aria-label="Technologies we build with"
        >
          {capabilities.map((tech) => (
            <li key={tech.slug}>
              <Badge tech={tech} />
            </li>
          ))}
          {capabilities.map((tech) => (
            <li key={`repeat-${tech.slug}`} aria-hidden="true">
              <Badge tech={tech} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
