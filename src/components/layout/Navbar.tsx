import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { NAV_CTA_LABEL, navItems } from '@/data/nav'
import { BrandMark } from './BrandMark'
import { MobileMenu } from './MobileMenu'

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[var(--color-canvas)]/70 backdrop-blur-xl">
      <div className="container-app flex h-[72px] items-center justify-between">
        <a
          href="#home"
          className="flex items-center gap-2.5"
          onClick={() => setOpen(false)}
          aria-label="Velnora home"
        >
          <BrandMark animated />
          <span className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
            Velnora
          </span>
        </a>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8">
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
        </nav>

        <div className="hidden lg:block">
          <Button href="#contact">{NAV_CTA_LABEL}</Button>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-2 text-[var(--color-ink)] lg:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-6 w-6" strokeWidth={1.75} /> : <Menu className="h-6 w-6" strokeWidth={1.75} />}
        </button>
      </div>

      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </header>
  )
}
