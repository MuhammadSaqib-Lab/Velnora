import {
  BrainCircuit,
  Boxes,
  Gauge,
  Layers,
  MousePointerClick,
  Search,
  Smartphone,
} from 'lucide-react'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'

const reasons = [
  { icon: Gauge, title: 'Performance', body: 'Pages built to load fast on real-world connections, not just lab conditions.' },
  { icon: Search, title: 'SEO-first development', body: 'Search structure decided before design starts, not patched in after.' },
  { icon: Layers, title: 'Modern technology', body: 'Current, well-supported frameworks that stay maintainable as you grow.' },
  { icon: MousePointerClick, title: 'Conversion-focused design', body: 'Every page built around a clear next action for the visitor.' },
  { icon: Smartphone, title: 'Mobile-first development', body: 'Designed for the device most visitors actually use first.' },
  { icon: Boxes, title: 'Scalable architecture', body: 'Component structures that extend cleanly as your site grows.' },
  { icon: BrainCircuit, title: 'AI-ready infrastructure', body: 'Built so future AI features slot in without a rebuild.' },
]

export function WhyChooseUs() {
  return (
    <section className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          eyebrow="Why Velnora"
          heading="What every engagement is built on"
          subtext="These aren't add-ons. They're the baseline every project ships with."
        />

        <div className="mt-12 -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reasons.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.05} className="snap-start">
              <div className="flex h-full w-[260px] shrink-0 flex-col rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-6 md:w-auto">
                <Icon className="h-5 w-5 text-[var(--color-accent)]" strokeWidth={1.75} />
                <h3 className="mt-4 text-sm font-medium text-[var(--color-ink)]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
