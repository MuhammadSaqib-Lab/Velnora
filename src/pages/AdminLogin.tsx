import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiPost, ApiNetworkError } from '@/lib/api'
import { useAdminSession } from '@/lib/useAdminSession'

/**
 * The Admin Dashboard's real entry point (replaces the old shared
 * admin-token prompt). Authentication itself is entirely server-side —
 * this page only collects credentials and reacts to the result, the
 * httpOnly session cookie that actually gates /api/admin/* and
 * /internal/admin/* is set by the backend, never read or stored here.
 */
export function AdminLogin() {
  const session = useAdminSession()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seoTag = (
    <Helmet>
      <title>Sign in — Velnora Admin</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  )

  if (session.status === 'authenticated') {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/internal/admin'
    return (
      <>
        {seoTag}
        <Navigate to={redirectTo} replace />
      </>
    )
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await apiPost<{ admin: { id: string; email: string } }>('/auth/admin/login', { email, password })
      if (res.success) {
        session.refresh()
        const redirectTo = (location.state as { from?: string } | null)?.from ?? '/internal/admin'
        navigate(redirectTo, { replace: true })
      } else {
        setError(res.message)
      }
    } catch (err) {
      setError(err instanceof ApiNetworkError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {seoTag}
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-6 py-12 text-[var(--color-ink)]">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <BrandMark animated className="h-9 w-9" />
            <h1 className="mt-4 text-lg font-semibold tracking-tight">Velnora Admin</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Sign in to manage leads and outreach.</p>
          </div>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="mt-8 space-y-4 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl"
          >
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-[var(--radius-field)] border border-red-400/25 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>{error}</span>
              </div>
            ) : null}

            <div>
              <label htmlFor="admin-email" className="text-xs font-medium text-[var(--color-ink-faint)]">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@velnora.com"
                className={`${fieldInputClass} mt-1.5`}
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="text-xs font-medium text-[var(--color-ink-faint)]">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`${fieldInputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--color-ink-faint)]">Internal only — not linked from the public site.</p>
        </div>
      </div>
    </>
  )
}
