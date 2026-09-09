import { CheckCircle2 } from 'lucide-react'
import { Reveal } from '@/components/ui/Reveal'

const siteTypes = [
  'Business websites',
  'Corporate websites',
  'E-commerce',
  'Landing pages',
  'SaaS websites',
  'Custom web apps',
]

const checklist = [
  'Responsive across every device',
  'Fast, optimized page loads',
  'Accessible to every visitor',
  'Security-conscious development',
  'Modern, maintainable technology',
  'Conversion-focused UX',
]

export function WebDevelopment() {
  return (
    <section className="py-28 md:py-36">
      <div className="container-app grid items-center gap-16 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <p className="text-sm font-medium text-[var(--color-accent)]">What we build</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[var(--color-ink)] md:text-4xl">
            Websites built to do a job, not just look nice
          </h2>
          <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[var(--color-ink-muted)]">
            From a first business website to a full custom web application, every build starts
            with what your visitors need to do, then works backward into design and code.
          </p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {siteTypes.map((type) => (
              <li
                key={type}
                className="rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-1.5 text-sm text-[var(--color-ink-muted)]"
              >
                {type}
              </li>
            ))}
          </ul>

          <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  strokeWidth={1.75}
                />
                <span className="text-sm text-[var(--color-ink-muted)]">{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="order-1 lg:order-2">
          <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-[var(--color-surface)] p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-1.5 px-2 pb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            </div>
            <img
              src="https://picsum.photos/seed/velnora-web-development/960/640"
              alt="Preview of a website interface built by Velnora"
              width={960}
              height={640}
              loading="lazy"
              className="aspect-[3/2] w-full rounded-[calc(var(--radius-panel)-8px)] object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
