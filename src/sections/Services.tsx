import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { services } from '@/data/services'
import { cn } from '@/lib/utils'

const layout = [
  { span: 'lg:col-span-2', tint: true },
  { span: 'lg:col-span-1 lg:row-span-2', tint: false },
  { span: 'lg:col-span-1', tint: false },
  { span: 'lg:col-span-1', tint: false },
  { span: 'lg:col-span-2', tint: true },
  { span: 'lg:col-span-1', tint: false },
]

export function Services() {
  return (
    <section id="services" className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          heading="Services built around growth, not gimmicks"
          subtext="Six disciplines, applied together so your site actually performs instead of just existing."
        />

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
          {services.map((service, i) => {
            const { icon: Icon, title, benefit, description } = service
            const { span, tint } = layout[i]

            return (
              <Reveal key={title} delay={i * 0.06} className={span}>
                <div
                  className={cn(
                    'group relative flex h-full flex-col rounded-[var(--radius-panel)] border border-white/[0.08] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-accent)]/40',
                    tint
                      ? 'bg-[linear-gradient(155deg,rgba(16,185,129,0.12),rgba(16,16,19,0.4))]'
                      : 'bg-white/[0.02]',
                  )}
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)]">
                    <Icon className="h-5 w-5 text-[var(--color-accent)]" strokeWidth={1.75} />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
                  <p className="mt-2 text-sm font-medium text-[var(--color-accent-soft)]">
                    {benefit}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {description}
                  </p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
