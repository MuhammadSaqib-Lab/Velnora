import { Sparkles } from 'lucide-react'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { projects } from '@/data/projects'
import { cn } from '@/lib/utils'

export function Work() {
  return (
    <section id="work" className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          eyebrow="Selected Work"
          heading="Work that shows how we build"
          subtext="A mix of real client work and concept projects built to demonstrate range and technical approach while our public case-study library grows — each one is labeled accordingly."
        />

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => (
            <Reveal
              key={project.name}
              delay={i * 0.06}
              className={i === 0 ? 'lg:col-span-2' : undefined}
            >
              <article className="group h-full overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] transition-colors duration-300 hover:border-[var(--color-accent)]/35">
                <div className="relative overflow-hidden">
                  <span className="absolute left-4 top-4 z-10 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] text-[var(--color-ink)] backdrop-blur">
                    {project.isConcept ? 'Coming Soon' : 'Client project'}
                  </span>
                  {project.isConcept ? (
                    <div
                      role="img"
                      aria-label={`${project.name} — case study coming soon`}
                      className={cn(
                        'flex items-center justify-center bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-canvas)]',
                        i === 0 ? 'aspect-[21/11]' : 'aspect-[3/2]',
                      )}
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <Sparkles className="h-6 w-6 text-[var(--color-accent)]/70" strokeWidth={1.5} />
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
                          Case study coming soon
                        </span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={project.image}
                      alt={`Screenshot of the ${project.name} website`}
                      loading="lazy"
                      className={cn(
                        'w-full object-cover transition-transform duration-500 group-hover:scale-105',
                        i === 0 ? 'aspect-[21/11]' : 'aspect-[3/2]',
                      )}
                    />
                  )}
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[var(--color-ink)]">
                      {project.name}
                    </h3>
                    <span className="shrink-0 text-xs text-[var(--color-ink-faint)]">
                      {project.industry}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {project.goal}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-white/[0.1] px-3 py-1 font-mono text-[11px] text-[var(--color-ink-muted)]"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
