import { Loader2, LogOut, Plus } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandMark } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { NEW_PROJECT_PATH, useClientSession } from '@/lib/useClientSession'
import type { ClientOutletContext } from './useClientOutlet'

/**
 * Layout + guard for everything under /client. An unauthenticated visitor
 * is redirected to /login with `?next=` set to the page they asked for, so
 * after logging in or signing up they land exactly where they were going
 * (notably the New Project form). This is a UX convenience only: every
 * /api/client/* request is independently authenticated and authorized by
 * the backend, which scopes all project data to the session's own client.
 */
export function ClientShell() {
  const session = useClientSession()
  const location = useLocation()

  const seoTag = (
    <Helmet>
      <title>My Projects — Velnora</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  )

  if (session.status === 'loading') {
    return (
      <>
        {seoTag}
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" strokeWidth={2} />
        </div>
      </>
    )
  }

  if (session.status === 'unauthenticated') {
    const next = `${location.pathname}${location.search}`
    return (
      <>
        {seoTag}
        <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
      </>
    )
  }

  const { client } = session

  return (
    <>
      {seoTag}
      <div className="relative min-h-screen overflow-x-clip bg-[var(--color-canvas)] text-[var(--color-ink)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-14rem] h-[26rem] w-[46rem] -translate-x-1/2 rounded-full bg-[var(--color-accent)]/[0.07] blur-3xl"
        />

        <header className="relative border-b border-white/[0.08] bg-[var(--color-canvas)]/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <Link to="/" aria-label="Velnora home" className="flex items-center gap-2.5">
              <BrandMark className="h-7 w-7" />
              <span className="text-base font-semibold tracking-tight">Velnora</span>
            </Link>

            <nav aria-label="Client area" className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
              <NavLink
                to="/client/projects"
                end
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3.5 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-white/[0.07] text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                  )
                }
              >
                My Projects
              </NavLink>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <Button href={NEW_PROJECT_PATH} className="px-4 py-2">
                <Plus className="h-4 w-4" strokeWidth={2.25} />
                New project
              </Button>
              <div className="hidden text-right text-xs leading-tight sm:block">
                <p className="max-w-[12rem] truncate font-medium text-[var(--color-ink)]" title={client.name}>
                  {client.name}
                </p>
                <p className="max-w-[12rem] truncate text-[var(--color-ink-faint)]" title={client.email}>
                  {client.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void session.signOut()}
                aria-label="Log out"
                title="Log out"
                className="rounded-full p-2 text-[var(--color-ink-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-ink)]"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </header>

        <main className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <Outlet context={{ client, onUnauthorized: session.markUnauthenticated } satisfies ClientOutletContext} />
        </main>
      </div>
    </>
  )
}
