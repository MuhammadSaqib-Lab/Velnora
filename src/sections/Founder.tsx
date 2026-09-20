import { Reveal } from '@/components/ui/Reveal'
import { services } from '@/data/services'

const expertise = services.map((service) => service.title)

export function Founder() {
  return (
    <section id="founder" className="py-28 md:py-36">
      <div className="container-app grid items-center gap-16 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal className="mx-auto w-full max-w-sm lg:mx-0">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 rounded-[calc(var(--radius-panel)+1.5rem)] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(16,185,129,0.16),transparent)]"
            />
            <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-[var(--color-surface)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
              <picture>
                <source
                  type="image/avif"
                  srcSet="/team/muhammad-saqib-480w.avif 480w, /team/muhammad-saqib-640w.avif 640w, /team/muhammad-saqib-960w.avif 960w"
                  sizes="(min-width: 1024px) 420px, 90vw"
                />
                <source
                  type="image/webp"
                  srcSet="/team/muhammad-saqib-480w.webp 480w, /team/muhammad-saqib-640w.webp 640w, /team/muhammad-saqib-960w.webp 960w"
                  sizes="(min-width: 1024px) 420px, 90vw"
                />
                <img
                  src="/team/muhammad-saqib-640w.jpg"
                  srcSet="/team/muhammad-saqib-480w.jpg 480w, /team/muhammad-saqib-640w.jpg 640w, /team/muhammad-saqib-960w.jpg 960w"
                  sizes="(min-width: 1024px) 420px, 90vw"
                  alt="Muhammad Saqib, Founder and Lead Developer at Velnora"
                  width={1254}
                  height={1254}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </picture>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-sm font-medium text-[var(--color-accent)]">Founder</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[var(--color-ink)] md:text-4xl">
            Muhammad Saqib
          </h2>
          <p className="mt-1.5 text-base font-medium text-[var(--color-ink-muted)]">
            Founder &amp; Lead Developer, Velnora
          </p>
          <p className="mt-5 max-w-[55ch] text-base leading-relaxed text-[var(--color-ink-muted)]">
            Building high-performance websites, AI-powered digital experiences, and intelligent
            automation solutions for growing businesses.
          </p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {expertise.map((title) => (
              <li
                key={title}
                className="rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-1.5 text-sm text-[var(--color-ink-muted)]"
              >
                {title}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
