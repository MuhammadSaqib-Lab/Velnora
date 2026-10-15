import { Bot, FolderKanban, LayoutDashboard, Loader2, Megaphone, MessageSquareText, Menu, Radar, SlidersHorizontal, Star, X, type LucideIcon } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AdminCountsProvider } from '@/components/internal/AdminCountsProvider'
import { ErrorState, PageSkeleton } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { AI_ASSISTANT_ENABLED } from '@/config/features'
import { useAdminCounts } from '@/lib/adminCountsContext'
import { ADMIN_SESSION_REJECTED } from '@/lib/adminEvents'
import { describeBadge, formatBadgeCount } from '@/lib/countBadge'
import type { SidebarCounts } from '@/lib/sidebarCounts'
import { cn } from '@/lib/utils'
import { hasAdminSessionHint, useAdminSession } from '@/lib/useAdminSession'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
  /** Which sidebar count (if any) belongs on this item, and how to say it to a screen reader. */
  badge?: { key: keyof SidebarCounts; singular: string; plural: string }
}

const NAV_ITEMS: NavItem[] = [
  { to: '/internal/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  {
    to: '/internal/admin/client-leads',
    label: 'Client Agent Leads',
    icon: MessageSquareText,
    end: false,
    badge: { key: 'clientAgentLeads', singular: 'new client agent lead', plural: 'new client agent leads' },
  },
  {
    to: '/internal/admin/lead-finder',
    label: 'Lead Finder',
    icon: Radar,
    end: false,
    badge: { key: 'leadFinder', singular: 'lead awaiting review', plural: 'leads awaiting review' },
  },
  {
    to: '/internal/admin/projects',
    label: 'Projects',
    icon: FolderKanban,
    end: false,
    badge: { key: 'projects', singular: 'new project request', plural: 'new project requests' },
  },
  {
    to: '/internal/admin/reviews',
    label: 'Reviews',
    icon: Star,
    end: false,
    badge: { key: 'reviews', singular: 'review awaiting moderation', plural: 'reviews awaiting moderation' },
  },
  {
    to: '/internal/admin/marketing',
    label: 'Digital Marketing',
    icon: Megaphone,
    end: false,
    badge: { key: 'digitalMarketing', singular: 'draft awaiting approval', plural: 'drafts awaiting approval' },
  },
  { to: '/internal/admin/agent-settings', label: 'Agent Settings', icon: SlidersHorizontal, end: false },
  // AI Assistant is TEMPORARILY DISABLED (src/config/features.ts): no nav entry while off.
  ...(AI_ASSISTANT_ENABLED ? [{ to: '/internal/admin/ai-assistant', label: 'AI Assistant', icon: Bot, end: false }] : []),
]

/** True once `active` has been true for `ms` — used to reassure when a (cold) server is slow to answer. */
function useAfterDelay(active: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setElapsed(true), ms)
    return () => {
      window.clearTimeout(timer)
      setElapsed(false)
    }
  }, [active, ms])
  return active && elapsed
}

/**
 * Admin Dashboard shell. Auth is a real server-side session (POST
 * /api/auth/admin/login sets an httpOnly cookie); this component asks the
 * server who we are via useAdminSession() and redirects to /admin/login only
 * when the server says 401. The backend independently re-verifies every
 * /api/admin/* request — this redirect is a UX convenience, not the security
 * boundary.
 *
 * Loading behavior:
 *  - A browser that had a working session before shows the frame (sidebar and
 *    layout) immediately, and the page's own requests start in parallel with
 *    the session check instead of waiting for it. No data is shown from the
 *    hint: pages render only what the server returns, and a 401 anywhere
 *    sends the admin to the login page.
 *  - A slow or unreachable server is an error with a Retry, never an endless
 *    spinner and never mistaken for being signed out.
 *  - Lazy page chunks load inside the layout (Suspense below), so the sidebar
 *    never disappears while a page loads.
 */
export function AdminShell() {
  // Without a hint this browser shows a plain waiting screen until the server answers.
  const [hadHint] = useState(hasAdminSessionHint)
  const session = useAdminSession({ optimistic: true })
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const slowConnection = useAfterDelay(session.status === 'loading', 8000)

  // Any admin request answered with 401 means the session ended: go to the login page.
  const markExpired = session.markExpired
  useEffect(() => {
    window.addEventListener(ADMIN_SESSION_REJECTED, markExpired)
    return () => window.removeEventListener(ADMIN_SESSION_REJECTED, markExpired)
  }, [markExpired])

  // The overview is the landing page: start fetching its code now rather than after the session check.
  useEffect(() => {
    if (location.pathname === '/internal/admin') void import('./Overview')
    // Only on first mount: it is a one-time head start for the landing page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (session.status === 'unauthenticated') {
    return (
      <>
        {seoTag}
        <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
      </>
    )
  }

  if (session.status === 'loading') {
    return (
      <>
        {seoTag}
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--color-canvas)] px-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" strokeWidth={2} />
          {slowConnection ? (
            <p role="status" className="max-w-sm text-sm text-[var(--color-ink-muted)]">
              Still connecting… the server may be starting up, which can take up to a minute.
            </p>
          ) : null}
        </div>
      </>
    )
  }

  if (session.status === 'error' && !hadHint) {
    return (
      <>
        {seoTag}
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-6">
          <div className="w-full max-w-md space-y-4">
            <ErrorState message={session.message} onRetry={session.refresh} />
            <Link to="/admin/login" className="block text-center text-sm text-[var(--color-ink-muted)] underline hover:text-[var(--color-ink)]">
              Go to sign in
            </Link>
          </div>
        </div>
      </>
    )
  }

  const adminEmail = session.status === 'authenticated' ? session.admin?.email : undefined
  const signOut = session.status === 'authenticated' ? session.signOut : undefined

  return (
    <>
      {seoTag}
      <AdminCountsProvider enabled={session.status === 'authenticated'} onUnauthorized={session.markExpired}>
        <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
          <div className="flex min-h-screen">
            <aside className="hidden w-60 shrink-0 border-r border-white/[0.08] bg-white/[0.02] lg:block">
              <SidebarContent adminEmail={adminEmail} onSignOut={signOut} />
            </aside>

            {mobileNavOpen ? (
              <div className="fixed inset-0 z-40 lg:hidden">
                <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
                <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/[0.08] bg-[var(--color-canvas)]">
                  <SidebarContent adminEmail={adminEmail} onSignOut={signOut} onNavigate={() => setMobileNavOpen(false)} />
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
                {session.status === 'error' ? (
                  <div className="max-w-xl space-y-4">
                    <ErrorState message={session.message} onRetry={session.refresh} />
                    <Button variant="secondary" href="/admin/login">
                      Go to sign in
                    </Button>
                  </div>
                ) : (
                  // Page code loads here, inside the layout: the sidebar stays on screen and usable.
                  <Suspense fallback={<PageSkeleton />}>
                    <Outlet />
                  </Suspense>
                )}
              </main>
            </div>
          </div>
        </div>
      </AdminCountsProvider>
    </>
  )
}

function NavCountBadge({ badge }: { badge: NonNullable<NavItem['badge']> }) {
  const { counts } = useAdminCounts()
  const count = counts?.[badge.key]
  const text = formatBadgeCount(count)
  if (text === null || typeof count !== 'number') return null
  return (
    <>
      {/* The number is visual; the sentence is what a screen reader hears, so meaning never rests on the pill alone. */}
      <span
        aria-hidden="true"
        className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-strong)] px-1.5 text-[11px] font-semibold leading-none text-zinc-950 tabular-nums"
      >
        {text}
      </span>
      <span className="sr-only">, {describeBadge(count, badge.singular, badge.plural)}</span>
    </>
  )
}

function SidebarContent({
  adminEmail,
  onSignOut,
  onNavigate,
}: {
  adminEmail?: string
  onSignOut?: () => void
  onNavigate?: () => void
}) {
  const { status: countsStatus, counts } = useAdminCounts()

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
        <nav className="mt-4 flex flex-col gap-1" aria-label="Admin sections">
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
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 truncate">{item.label}</span>
              {item.badge ? <NavCountBadge badge={item.badge} /> : null}
            </NavLink>
          ))}
        </nav>
        {countsStatus === 'error' ? (
          <p role="status" className="mt-3 px-3 text-xs text-[var(--color-ink-faint)]">
            {counts ? 'Counts may be out of date — couldn’t refresh.' : 'Counts are unavailable right now.'}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-white/[0.08] pt-4 text-xs text-[var(--color-ink-faint)]">
        {adminEmail ? (
          <p className="truncate" title={adminEmail}>
            {adminEmail}
          </p>
        ) : (
          <p className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" aria-hidden="true" />
        )}
        <p>Internal only — not linked from the public site.</p>
        <button
          type="button"
          onClick={() => void onSignOut?.()}
          disabled={!onSignOut}
          className="underline hover:text-[var(--color-ink)] disabled:no-underline disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
