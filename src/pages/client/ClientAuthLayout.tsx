import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { BrandMark } from '@/components/layout/BrandMark'

/**
 * Shared frame for the client login / sign-up pages: brand mark, a soft
 * emerald glow (same single accent as the rest of the site), and a glass
 * card. Both pages are noindex — they are utility pages, not content.
 */
export function ClientAuthLayout({
  title,
  subtitle,
  notice,
  children,
  footer,
  wide = false,
}: {
  title: string
  subtitle: string
  notice?: ReactNode
  children: ReactNode
  footer: ReactNode
  wide?: boolean
}) {
  return (
    <>
      <Helmet>
        <title>{`${title} — Velnora`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-canvas)] px-4 py-10 text-[var(--color-ink)] sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-12rem] h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-[var(--color-accent)]/[0.09] blur-3xl"
        />
        <div className={wide ? 'relative w-full max-w-lg' : 'relative w-full max-w-md'}>
          <Link to="/" aria-label="Velnora home" className="flex flex-col items-center text-center">
            <BrandMark animated className="h-10 w-10" />
            <span className="mt-3 text-lg font-semibold tracking-tight">Velnora</span>
          </Link>

          <div className="mt-7 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>
          </div>

          {notice ? (
            <div
              role="status"
              className="mt-5 rounded-[var(--radius-panel)] border border-[var(--color-accent)]/25 bg-[var(--color-accent-dim)] px-4 py-3 text-center text-sm text-[var(--color-ink)]"
            >
              {notice}
            </div>
          ) : null}

          <div className="mt-6 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-7">
            {children}
          </div>

          <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">{footer}</p>
          <p className="mt-3 text-center text-xs text-[var(--color-ink-faint)]">
            <Link to="/" className="underline hover:text-[var(--color-ink)]">
              Back to velnora.com
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
