import { Helmet } from 'react-helmet-async'
import { BrandMark } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui/Button'

/**
 * Catch-all for any unmatched route (see App.tsx's <Route path="*">).
 * Without this, React Router renders nothing for a dead/mistyped link —
 * a blank page with a 200 status, which is exactly the "soft 404" shape
 * search engines flag as a genuine problem, not a graceful failure.
 * `noindex` here since an error page has nothing worth indexing.
 */
export function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 text-center text-[var(--color-ink)]">
      <Helmet>
        <title>Page not found | Velnora</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <BrandMark className="h-8 w-8" />
      <p className="mt-6 text-sm font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">This page doesn't exist.</h1>
      <p className="mt-3 max-w-sm text-sm text-[var(--color-ink-muted)]">
        The link you followed may be broken, or the page may have moved.
      </p>
      <Button href="/" className="mt-8">
        Back to homepage
      </Button>
    </div>
  )
}
