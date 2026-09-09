import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'

const pillars = [
  {
    title: 'Mission',
    body: 'Help growing businesses compete online with websites and systems built on the same technology and rigor larger companies use.',
  },
  {
    title: 'Vision',
    body: "A web where a small business's site performs as well as its best salesperson, around the clock.",
  },
  {
    title: 'Approach',
    body: 'Strategy first, design second, code third. Every decision traces back to a business outcome, not a trend.',
  },
  {
    title: 'Why Velnora',
    body: 'One team across web development, AI, and SEO, so your site, content, and search performance are never working against each other.',
  },
]

export function About() {
  return (
    <section id="about" className="py-28 md:py-36">
      <div className="container-app">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            heading="A technology partner, not just a vendor"
            subtext="Velnora exists to close the gap between what a business needs online and what a generic template or freelance patchwork can deliver."
            className="lg:sticky lg:top-32"
          />

          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {pillars.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 0.07}>
                <div className="border-t border-white/[0.1] pt-5">
                  <h3 className="text-sm font-medium text-[var(--color-accent)]">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-[var(--color-ink-muted)]">
                    {pillar.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
