import { LayoutDashboard, Loader2, MessageSquareText, Menu, Radar, Star, X } from 'lucide-react'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAdminSession } from '@/lib/useAdminSession'

const NAV_ITEMS = [
  { to: '/internal/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/internal/admin/client-leads', label: 'Client Agent Leads', icon: MessageSquareText, end: false },
  { to: '/internal/admin/lead-finder', label: 'Lead Finder', icon: Radar, end: false },
  { to: '/internal/admin/reviews', label: 'Reviews', icon: Star, end: false },
]

/**
 * Phase 5 Admin Dashboard shell. Auth is now a real server-side session
 * (POST /api/auth/admin/login sets an httpOnly cookie) instead of the
 * old shared-token prompt — this component's only job is to check that
 * session via useAdminSession() and redirect to /admin/login when it's
 * missing; the backend independently re-verifies every /api/admin/*
 * request on its own, this redirect is a UX convenience, not the
 * security boundary. Child routes no longer need any auth context
 * (no more per-request header to thread through, the browser attaches
 * the session cookie automatically), so <Outlet> takes no context.
 */
export function AdminShell() {
  const session = useAdminSession()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Rendered unconditionally across every branch below — a prior version
  // of this dashboard's gate only rendered its noindex tag in one
  // branch, which silently dropped it once past that branch. Never
  // repeat that here.
  const seoTag = (
    <Helmet>
      <title>Velnora Admin</title>
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
    return (
      <>
        {seoTag}
        <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
      </>
    )
  }

  return (
    <>
      {seoTag}
      <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 border-r border-white/[0.08] bg-white/[0.02] lg:block">
            <SidebarContent adminEmail={session.admin.email} onSignOut={session.signOut} />
          </aside>

          {mobileNavOpen ? (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
              <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/[0.08] bg-[var(--color-canvas)]">
                <SidebarContent
                  adminEmail={session.admin.email}
                  onSignOut={session.signOut}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </aside>
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <header className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                className="text-[var(--color-ink-muted)]"
              >
                <Menu className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <span className="text-sm font-medium">Velnora Admin</span>
            </header>

            <main className="p-4 sm:p-6 lg:p-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </>
  )
}

function SidebarContent({
  adminEmail,
  onSignOut,
  onNavigate,
}: {
  adminEmail: string
  onSignOut: () => void
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col justify-between p-4">
      <div>
        <div className="flex items-center justify-between px-1 py-2">
          <span className="text-sm font-semibold">Velnora Admin</span>
          {onNavigate ? (
            <button type="button" onClick={onNavigate} aria-label="Close navigation" className="text-[var(--color-ink-faint)]">
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-[var(--radius-field)] px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                    : 'text-[var(--color-ink-muted)] hover:bg-white/[0.04] hover:text-[var(--color-ink)]',
                )
              }
            >
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-2 border-t border-white/[0.08] pt-4 text-xs text-[var(--color-ink-faint)]">
        <p className="truncate" title={adminEmail}>{adminEmail}</p>
        <p>Internal only — not linked from the public site.</p>
        <button type="button" onClick={() => void onSignOut()} className="underline hover:text-[var(--color-ink)]">
          Sign out
        </button>
      </div>
    </div>
  )
}
