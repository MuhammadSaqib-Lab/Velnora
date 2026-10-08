import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { PasswordInput } from '@/components/client/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiPost, ApiNetworkError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { MAX_LENGTHS } from '@/lib/validation'
import { NEW_PROJECT_PATH, safeNextPath, useClientSession } from '@/lib/useClientSession'
import { ClientAuthLayout } from './ClientAuthLayout'

type FieldName = 'name' | 'email' | 'phone' | 'company' | 'password' | 'confirmPassword'
type Errors = Partial<Record<FieldName, string>>

const MIN_PASSWORD = 10
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[0-9+\-().\s]{6,30}$/

/** Mirrors backend/src/validators/clientAuth.validator.ts (the backend is the authority). */
function passwordChecks(password: string) {
  return [
    { label: `At least ${MIN_PASSWORD} characters`, ok: password.length >= MIN_PASSWORD },
    { label: 'A letter and a number', ok: /[A-Za-z]/.test(password) && /[0-9]/.test(password) },
  ]
}

function validate(values: Record<FieldName, string>): Errors {
  const errors: Errors = {}
  if (!values.name.trim()) errors.name = 'Enter your full name'
  if (!values.email.trim()) errors.email = 'Enter your email'
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email address'
  if (values.phone.trim() && !PHONE_PATTERN.test(values.phone.trim())) errors.phone = 'Enter a valid phone number'
  if (passwordChecks(values.password).some((check) => !check.ok)) errors.password = 'Choose a stronger password'
  if (!values.confirmPassword) errors.confirmPassword = 'Confirm your password'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match'
  return errors
}

/**
 * Client sign-up. The backend creates the account AND the session in one
 * request, so the client is signed in the moment this succeeds and goes
 * straight on (default: the New Project form) without a second login.
 */
export function ClientSignup() {
  const session = useClientSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const rawNext = params.get('next')
  const next = safeNextPath(rawNext, NEW_PROJECT_PATH)
  const startingProject = next === NEW_PROJECT_PATH

  const [values, setValues] = useState<Record<FieldName, string>>({
    name: '',
    email: '',
    phone: '',
    company: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (session.status === 'authenticated') return <Navigate to={next} replace />

  const loginHref = rawNext ? `/login?next=${encodeURIComponent(next)}` : '/login'

  function set(field: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setFormError(null)

    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setIsSubmitting(true)
    try {
      const res = await apiPost('/client/auth/register', {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        phone: values.phone.trim(),
        company: values.company.trim(),
      })
      if (res.success) {
        navigate(next, { replace: true })
      } else if (res.errors) {
        setErrors(res.errors as Errors)
        setFormError('Please check the highlighted fields.')
      } else {
        setFormError(res.status === 429 ? 'Too many sign-up attempts. Please try again later.' : res.message)
      }
    } catch (err) {
      setFormError(err instanceof ApiNetworkError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const checks = passwordChecks(values.password)

  return (
    <ClientAuthLayout
      wide
      title="Create your account"
      subtitle="One account to submit projects and follow their progress."
      notice={startingProject ? 'Create your Velnora account or log in to start your project.' : undefined}
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginHref} className="font-medium text-[var(--color-accent)] hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-5">
        {formError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-field)] border border-red-400/25 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>{formError}</span>
          </div>
        ) : null}

        <Field label="Full name" htmlFor="client-name" error={errors.name}>
          <input
            id="client-name"
            autoComplete="name"
            autoFocus
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={MAX_LENGTHS.name}
            aria-invalid={errors.name ? true : undefined}
            className={fieldInputClass}
          />
        </Field>

        <Field label="Email" htmlFor="client-email" error={errors.email}>
          <input
            id="client-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="you@company.com"
            maxLength={MAX_LENGTHS.email}
            aria-invalid={errors.email ? true : undefined}
            className={fieldInputClass}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone" htmlFor="client-phone" optional error={errors.phone}>
            <input
              id="client-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
              maxLength={MAX_LENGTHS.phone}
              aria-invalid={errors.phone ? true : undefined}
              className={fieldInputClass}
            />
          </Field>
          <Field label="Company or business" htmlFor="client-company" optional error={errors.company}>
            <input
              id="client-company"
              autoComplete="organization"
              value={values.company}
              onChange={(e) => set('company', e.target.value)}
              maxLength={MAX_LENGTHS.company}
              className={fieldInputClass}
            />
          </Field>
        </div>

        <Field label="Password" htmlFor="client-password" error={errors.password}>
          <PasswordInput
            id="client-password"
            value={values.password}
            onChange={(v) => set('password', v)}
            autoComplete="new-password"
            describedBy="client-password-rules"
            invalid={Boolean(errors.password)}
          />
          <ul id="client-password-rules" className="mt-1 space-y-1">
            {checks.map((check) => (
              <li
                key={check.label}
                className={cn('flex items-center gap-1.5 text-xs', check.ok ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-faint)]')}
              >
                <Check className={cn('h-3 w-3', !check.ok && 'opacity-30')} strokeWidth={3} aria-hidden="true" />
                {check.label}
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Confirm password" htmlFor="client-confirm" error={errors.confirmPassword}>
          <PasswordInput
            id="client-confirm"
            value={values.confirmPassword}
            onChange={(v) => set('confirmPassword', v)}
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
          />
        </Field>

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              Creating your account…
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </ClientAuthLayout>
  )
}
