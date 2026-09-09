import { Link2, ScanSearch, Search, Smartphone, Tags, Zap } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'

const clusters = [
  {
    title: 'Technical foundation',
    items: [
      { icon: ScanSearch, label: 'Semantic HTML and clean heading structure' },
      { icon: Zap, label: 'Core Web Vitals and page-speed performance' },
      { icon: Tags, label: 'Structured data so search engines understand the page' },
    ],
  },
  {
    title: 'Visibility and reach',
    items: [
      { icon: Search, label: 'Content structured around real search intent' },
      { icon: Smartphone, label: 'Mobile-first responsive design' },
      { icon: Link2, label: 'Clean internal linking and crawlable navigation' },
    ],
  },
]

export function SEOSection() {
  return (
    <section id="seo" className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          eyebrow="Search & Visibility"
          heading="SEO built in from the first line of code"
          subtext="Search visibility isn't a step we add after launch. It shapes the markup, content structure, and page speed from day one."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {clusters.map((cluster, ci) => (
            <Reveal key={cluster.title} delay={ci * 0.1}>
              <GlassPanel className="h-full p-8">
                <h3 className="text-base font-medium text-[var(--color-ink)]">{cluster.title}</h3>
                <ul className="mt-5 space-y-4">
                  {cluster.items.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-dim)]">
                        <Icon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
                      </span>
                      <span className="pt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
