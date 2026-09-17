import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches unexpected render-time crashes anywhere below it (e.g. a
 * component choking on an unexpected data shape) so the user sees a
 * recoverable screen instead of a blank page. This is a different layer
 * from the API-level error handling in src/lib/api.ts (ApiNetworkError,
 * per-page ErrorState components) — those handle a *failed request*,
 * this handles a *crash while rendering*, which is otherwise fatal to
 * the whole React tree.
 *
 * Must be a class component: React only supports error boundaries via
 * getDerivedStateFromError/componentDidCatch, there is no hook
 * equivalent. componentDidCatch is intentionally a no-op beyond setting
 * state — this codebase has no console.* calls anywhere (see
 * SECURITY.md's "Information leakage" audit) and no error-reporting
 * service to send this to; React's own dev-mode overlay already surfaces
 * the real error during development.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Intentionally empty — see class comment.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-canvas)] px-6 text-center text-[var(--color-ink)]">
          <h1 className="text-lg font-semibold">Something went wrong.</h1>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            This page hit an unexpected error. Reloading usually fixes it.
          </p>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      )
    }

    return this.props.children
  }
}
