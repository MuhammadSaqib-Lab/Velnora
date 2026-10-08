import { AlertCircle, ArrowLeft, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { fieldInputClass, selectFieldClass } from '@/components/ui/fieldStyles'
import { apiPost, ApiNetworkError } from '@/lib/api'
import { PROJECT_TIMELINES, PROJECT_TYPES, type ClientProject } from '@/lib/projects'
import { MAX_LENGTHS, isSafeHttpUrl } from '@/lib/validation'
import { CLIENT_HOME } from '@/lib/useClientSession'
import { useClientOutlet } from './useClientOutlet'

type FieldName =
  | 'projectName'
  | 'projectType'
  | 'description'
  | 'websiteUrl'
  | 'targetAudience'
  | 'requiredFeatures'
  | 'budgetRange'
  | 'timeline'
  | 'additionalNotes'

type Values = Record<FieldName, string>
type Errors = Partial<Record<FieldName, string>>

// Mirrors backend/src/validators/project.validator.ts (the backend is the authority).
const LIMITS = { projectName: 120, description: 5000, targetAudience: 500, requiredFeatures: 3000, additionalNotes: 2000 } as const

const EMPTY: Values = {
  projectName: '',
  projectType: '',
  description: '',
  websiteUrl: '',
  targetAudience: '',
  requiredFeatures: '',
  budgetRange: '',
  timeline: '',
  additionalNotes: '',
}

function validate(v: Values): Errors {
  const errors: Errors = {}
  if (v.projectName.trim().length < 3) errors.projectName = 'Give your project a name (at least 3 characters)'
  if (!v.projectType) errors.projectType = 'Choose a project type'
  if (v.description.trim().length < 20) errors.description = 'Tell us a bit more — at least 20 characters'
  if (v.websiteUrl.trim() && !isSafeHttpUrl(v.websiteUrl.trim())) errors.websiteUrl = 'Include the full link, starting with https://'
  return errors
}

/**
 * The project submission form. Account details (name/email/phone/company)
 * are shown read-only from the signed-in account and are NOT sent — the
 * backend derives the owner from the session, so there is no client id,
 * email or status in the request body at all.
 */
export function NewProject() {
  const { client, onUnauthorized } = useClientOutlet()
  const navigate = useNavigate()

  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    if (Object.keys(found).length > 0) {
      setFormError('Please check the highlighted fields.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiPost<{ project: ClientProject }>('/client/projects', {
        projectName: values.projectName.trim(),
        projectType: values.projectType,
        description: values.description.trim(),
        websiteUrl: values.websiteUrl.trim(),
        targetAudience: values.targetAudience.trim(),
        requiredFeatures: values.requiredFeatures.trim(),
        budgetRange: values.budgetRange.trim(),
        timeline: values.timeline,
        additionalNotes: values.additionalNotes.trim(),
      })

      if (res.success && res.data) {
        navigate(CLIENT_HOME, { replace: true, state: { submitted: res.data.project.projectNumber } })
      } else if (!res.success) {
        if (res.status === 401) {
          onUnauthorized()
          return
        }
        if (res.errors) setErrors(res.errors as Errors)
        setFormError(
          res.status === 429 ? 'You have submitted several projects recently. Please wait a while before sending another.' : res.message,
        )
      }
    } catch (err) {
      setFormError(err instanceof ApiNetworkError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={CLIENT_HOME} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        My Projects
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Start a project</h1>
      <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
        Tell us about what you want to build. We&apos;ll review it and keep you updated right here.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-8 space-y-8">
        <section aria-labelledby="about-you" className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
          <h2 id="about-you" className="text-sm font-medium text-[var(--color-ink)]">
            Submitting as
          </h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--color-ink-faint)]">Name</dt>
              <dd className="break-words">{client.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-ink-faint)]">Email</dt>
              <dd className="break-all">{client.email}</dd>
            </div>
            {client.phone ? (
              <div>
                <dt className="text-xs text-[var(--color-ink-faint)]">Phone</dt>
                <dd>{client.phone}</dd>
              </div>
            ) : null}
            {client.company ? (
              <div>
                <dt className="text-xs text-[var(--color-ink-faint)]">Company</dt>
                <dd className="break-words">{client.company}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">These come from your account, so you don&apos;t need to enter them again.</p>
        </section>

        <section aria-labelledby="about-project" className="space-y-5">
          <h2 id="about-project" className="text-sm font-medium text-[var(--color-ink)]">
            Your project
          </h2>

          <Field label="Project name" htmlFor="project-name" error={errors.projectName}>
            <input
              id="project-name"
              value={values.projectName}
              onChange={(e) => set('projectName', e.target.value)}
              maxLength={LIMITS.projectName}
              placeholder="e.g. Online store for my bakery"
              aria-invalid={errors.projectName ? true : undefined}
              className={fieldInputClass}
            />
          </Field>

          <Field label="Project type" htmlFor="project-type" error={errors.projectType}>
            <select
              id="project-type"
              value={values.projectType}
              onChange={(e) => set('projectType', e.target.value)}
              aria-invalid={errors.projectType ? true : undefined}
              className={selectFieldClass}
            >
              <option value="">Choose one…</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Project description" htmlFor="project-description" error={errors.description}>
            <textarea
              id="project-description"
              rows={6}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={LIMITS.description}
              placeholder="Tell us about your project, goals, and requirements."
              aria-invalid={errors.description ? true : undefined}
              className={`${fieldInputClass} resize-y leading-relaxed`}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Current website" htmlFor="project-website" optional error={errors.websiteUrl}>
              <input
                id="project-website"
                type="url"
                inputMode="url"
                value={values.websiteUrl}
                onChange={(e) => set('websiteUrl', e.target.value)}
                maxLength={MAX_LENGTHS.url}
                placeholder="https://"
                aria-invalid={errors.websiteUrl ? true : undefined}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Target audience" htmlFor="project-audience" optional error={errors.targetAudience}>
              <input
                id="project-audience"
                value={values.targetAudience}
                onChange={(e) => set('targetAudience', e.target.value)}
                maxLength={LIMITS.targetAudience}
                placeholder="Who is it for?"
                className={fieldInputClass}
              />
            </Field>
          </div>

          <Field label="Required features" htmlFor="project-features" optional error={errors.requiredFeatures}>
            <textarea
              id="project-features"
              rows={4}
              value={values.requiredFeatures}
              onChange={(e) => set('requiredFeatures', e.target.value)}
              maxLength={LIMITS.requiredFeatures}
              placeholder="Anything it must do — online ordering, bookings, a blog, integrations…"
              className={`${fieldInputClass} resize-y leading-relaxed`}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Budget" htmlFor="project-budget" optional error={errors.budgetRange}>
              <input
                id="project-budget"
                value={values.budgetRange}
                onChange={(e) => set('budgetRange', e.target.value)}
                maxLength={MAX_LENGTHS.budget}
                placeholder="A rough range, or “not sure yet”"
                className={fieldInputClass}
              />
            </Field>
            <Field label="Timeline" htmlFor="project-timeline" optional error={errors.timeline}>
              <select
                id="project-timeline"
                value={values.timeline}
                onChange={(e) => set('timeline', e.target.value)}
                className={selectFieldClass}
              >
                <option value="">No preference</option>
                {PROJECT_TIMELINES.map((timeline) => (
                  <option key={timeline.value} value={timeline.value}>
                    {timeline.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Additional notes" htmlFor="project-notes" optional error={errors.additionalNotes}>
            <textarea
              id="project-notes"
              rows={3}
              value={values.additionalNotes}
              onChange={(e) => set('additionalNotes', e.target.value)}
              maxLength={LIMITS.additionalNotes}
              className={`${fieldInputClass} resize-y leading-relaxed`}
            />
          </Field>
        </section>

        {formError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-field)] border border-red-400/25 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>{formError}</span>
          </div>
        ) : null}

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button href={CLIENT_HOME} variant="ghost" className="justify-center">
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting} className="justify-center">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Submitting…
              </>
            ) : (
              <>
                Submit project
                <Send className="h-4 w-4" strokeWidth={2} />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
