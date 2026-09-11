import { Button } from '@/components/ui/Button'
import { NAV_CTA_LABEL, navItems } from '@/data/nav'
import { services } from '@/data/services'
import { BrandMark } from './BrandMark'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/[0.06] bg-[var(--color-surface)]">
      <div className="container-app grid gap-10 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <a href="#home" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
              Velnora
            </span>
          </a>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-ink-muted)]">
            An AI-powered web development studio building fast, well-structured websites and
            digital systems for businesses that want more from their online presence.
          </p>
          <Button href="#contact" variant="secondary" className="mt-6">
            {NAV_CTA_LABEL}
          </Button>
        </div>

        <div>
          <h3 className="text-sm font-medium text-[var(--color-ink)]">Explore</h3>
          <ul className="mt-4 space-y-3">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-[var(--color-ink)]">Services</h3>
          <ul className="mt-4 space-y-3">
            {services.slice(0, 4).map((service) => (
              <li key={service.title}>
                <a
                  href="#services"
                  className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                >
                  {service.title}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="mailto:muhammadsaqib9117994@gmail.com"
            className="mt-6 inline-block text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-soft)]"
          >
            muhammadsaqib9117994@gmail.com
          </a>
        </div>
      </div>

      <div className="container-app flex flex-col gap-3 border-t border-white/[0.06] py-6 text-xs text-[var(--color-ink-faint)] sm:flex-row sm:items-center sm:justify-between">
        <p>Copyright {year} Velnora. All rights reserved.</p>
        <p>Designed and built in-house.</p>
      </div>
    </footer>
  )
}
