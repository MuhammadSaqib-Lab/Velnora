import { useState, type ReactNode } from 'react'
import { Helmet } from 'react-helmet-async'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { useAdminToken } from '@/lib/useAdminToken'

/**
 * Shared entry gate for every /internal/admin/* page. Renders a token
 * prompt until a token is present in sessionStorage, then renders
 * `children` with the resolved `{ token, headers, signOut }` — the API
 * gate itself lives server-side (requireAdminToken.ts); this component
 * only decides what to render client-side, it enforces nothing.
 */
export function AdminTokenGate({
  title,
  children,
}: {
  title: string
  children: (ctx: { token: string; headers: Record<string, string>; signOut: () => void }) => ReactNode
}) {
  const { token, setToken, signOut, headers } = useAdminToken()
  const [tokenInput, setTokenInput] = useState('')

  // Rendered unconditionally (both branches, not just pre-login) — every
  // /internal/admin/* page must stay noindex regardless of auth state.
  // This was previously only inside the pre-login branch, which meant
  // the entire authenticated dashboard carried NO robots directive at
  // all once logged in (defaulting to indexable), caught during manual
  // verification.
  const seoTag = (
    <Helmet>
      <title>{title}</title>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  )

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-6 text-[var(--color-ink)]">
        {seoTag}
        <div className="w-full max-w-sm rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Enter the Lead Finder admin token (<code className="text-[var(--color-ink-faint)]">LEAD_FINDER_ADMIN_TOKEN</code>) to
            continue.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setToken(tokenInput.trim())
            }}
          >
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Admin token"
              autoFocus
              className={`${fieldInputClass} mt-4`}
            />
            <Button type="submit" className="mt-3 w-full justify-center">
              Continue
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <>
      {seoTag}
      {children({ token, headers, signOut })}
    </>
  )
}
