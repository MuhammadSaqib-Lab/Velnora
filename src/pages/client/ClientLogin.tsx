import { AlertCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { PasswordInput } from '@/components/client/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiPost, ApiNetworkError } from '@/lib/api'
import { CLIENT_HOME, NEW_PROJECT_PATH, safeNextPath, useClientSession } from '@/lib/useClientSession'
import { ClientAuthLayout } from './ClientAuthLayout'

/**
 * Client login. Credentials are only ever sent to the backend, which sets
 * the httpOnly session cookie — nothing about the session is stored or
 * readable here. Where to go afterwards comes from `?next=` (validated by
 * safeNextPath to same-site /client paths only), so someone who clicked
 * "Start a Project" continues to the project form instead of starting over.
 */
export function ClientLogin() {
  const session = useClientSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const rawNext = params.get('next')
  const next = safeNextPath(rawNext, CLIENT_HOME)
  const startingProject = next === NEW_PROJECT_PATH

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session.status === 'authenticated') return <Navigate to={next} replace />

  const signupHref = rawNext ? `/signup?next=${encodeURIComponent(next)}` : '/signup'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiPost('/client/auth/login', { email: email.trim(), password })
      if (res.success) {
        navigate(next, { replace: true })
      } else {
        setError(
          res.status === 429
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : res.status === 401
              ? 'That email and password don’t match. Check them and try again.'
              : res.message,
        )
      }
    } catch (err) {
      setError(err instanceof ApiNetworkError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ClientAuthLayout
      title="Welcome back"
      subtitle="Log in to see your projects and their status."
      notice={startingProject ? 'Create your Velnora account or log in to start your project.' : undefined}
      footer={
        <>
          New to Velnora?{' '}
          <Link to={signupHref} className="font-medium text-[var(--color-accent)] hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-5">
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-field)] border border-red-400/25 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        ) : null}

        <Field label="Email" htmlFor="client-login-email">
          <input
            id="client-login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            maxLength={254}
            className={fieldInputClass}
          />
        </Field>

        <Field label="Password" htmlFor="client-login-password">
          <PasswordInput
            id="client-login-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="Your password"
          />
        </Field>

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Logging in…
            </>
          ) : (
            'Log in'
          )}
        </Button>
      </form>
    </ClientAuthLayout>
  )
}
