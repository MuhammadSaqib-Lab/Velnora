import { AlertCircle, CheckCircle2, ChevronDown, Mail, MessageSquareText, ShieldCheck, Zap } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { FileHandover } from '@/components/contact/FileHandover'
import { TrustGuarantees } from '@/components/contact/TrustGuarantees'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { fieldInputClass, selectFieldClass } from '@/components/ui/fieldStyles'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ApiNetworkError, apiPost } from '@/lib/api'
import { validateContactForm, type ContactFormData, type ContactFormErrors } from '@/lib/contact'
import { ESTIMATE_REQUEST_EVENT, type PendingEstimate } from '@/lib/estimateHandoff'
import { MAX_LENGTHS } from '@/lib/validation'

const initialForm: ContactFormData = {
  name: '',
  email: '',
  company: '',
  phone: '',
  projectType: '',
  budget: '',
  message: '',
  repoLink: '',
}

export function Contact() {
  const [form, setForm] = useState<ContactFormData>(initialForm)
  const [attachments, setAttachments] = useState<File[]>([])
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    function handleEstimateRequest(event: Event) {
      const { detail } = event as CustomEvent<PendingEstimate>
      setForm((prev) => ({
        ...prev,
        projectType: detail.projectType,
        budget: detail.budget,
        message: detail.message,
      }))
    }

    window.addEventListener(ESTIMATE_REQUEST_EVENT, handleEstimateRequest)
    return () => window.removeEventListener(ESTIMATE_REQUEST_EVENT, handleEstimateRequest)
  }, [])

  function updateField<K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleAddFiles(newFiles: File[]) {
    setAttachments((prev) => [...prev, ...newFiles])
  }

  function handleRemoveFile(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateContactForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitError(null)
    setStatus('submitting')

    // Attachments and repoLink are collected for context, but real file
    // bytes aren't uploaded anywhere yet (see FileHandover.tsx), only the
    // text fields go to the backend.
    try {
      const result = await apiPost<{ id: string }>('/project-inquiry', {
        name: form.name,
        email: form.email,
        company: form.company || undefined,
        phone: form.phone || undefined,
        projectType: form.projectType || undefined,
        budgetRange: form.budget || undefined,
        message: form.message,
        repoLink: form.repoLink || undefined,
      })

      if (result.success) {
        setStatus('success')
        return
      }

      if (result.errors) {
        setErrors({
          name: result.errors.name,
          email: result.errors.email,
          company: result.errors.company,
          phone: result.errors.phone,
          projectType: result.errors.projectType,
          budget: result.errors.budgetRange,
          message: result.errors.message,
          repoLink: result.errors.repoLink,
        })
      } else {
        setSubmitError(result.message)
      }
      setStatus('idle')
    } catch (error) {
      setSubmitError(
        error instanceof ApiNetworkError
          ? error.message
          : 'Something went wrong on our end. Please try again shortly.',
      )
      setStatus('idle')
    }
  }

  if (status === 'success') {
    return (
      <section id="contact" className="py-28 md:py-36">
        <div className="container-app">
          <Reveal className="mx-auto max-w-lg text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--color-accent)]" strokeWidth={1.5} />
            <h2 className="mt-5 text-2xl font-semibold text-[var(--color-ink)]">
              Thanks, that's in.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-ink-muted)]">
              We've received your project details and will get back to you within one business
              day.
            </p>
            <Button
              variant="secondary"
              className="mt-8"
              onClick={() => {
                setForm(initialForm)
                setAttachments([])
                setErrors({})
                setSubmitError(null)
                setStatus('idle')
              }}
            >
              Send another message
            </Button>
          </Reveal>
        </div>
      </section>
    )
  }

  return (
    <section id="contact" className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          heading="Tell us about your project"
          subtext="Share a few details and we'll follow up with next steps. No automated calls, no spam."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <form noValidate onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" error={errors.name}>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength={MAX_LENGTHS.name}
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={fieldInputClass}
                  placeholder="Jordan Ashworth"
                />
              </Field>

              <Field label="Email" htmlFor="email" error={errors.email}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={MAX_LENGTHS.email}
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={fieldInputClass}
                  placeholder="you@company.com"
                />
              </Field>

              <Field label="Company" htmlFor="company" optional>
                <input
                  id="company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  maxLength={MAX_LENGTHS.company}
                  value={form.company}
                  onChange={(e) => updateField('company', e.target.value)}
                  className={fieldInputClass}
                  placeholder="Company name"
                />
              </Field>

              <Field label="Phone" htmlFor="phone" optional>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={MAX_LENGTHS.phone}
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className={fieldInputClass}
                  placeholder="+1 (555) 000-0000"
                />
              </Field>

              <Field label="Project type" htmlFor="projectType" optional>
                <div className="relative">
                  <select
                    id="projectType"
                    name="projectType"
                    value={form.projectType}
                    onChange={(e) => updateField('projectType', e.target.value)}
                    className={selectFieldClass}
                  >
                    <option value="">Select an option</option>
                    <option value="new-website">New website</option>
                    <option value="redesign">Website redesign</option>
                    <option value="ai-solution">AI-powered solution</option>
                    <option value="seo">SEO</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
              </Field>

              <Field label="Budget range" htmlFor="budget" optional>
                <div className="relative">
                  <select
                    id="budget"
                    name="budget"
                    value={form.budget}
                    onChange={(e) => updateField('budget', e.target.value)}
                    className={selectFieldClass}
                  >
                    <option value="">Select a range</option>
                    <option value="under-500">Under $500 (quick fixes)</option>
                    <option value="500-1k">$500 to $1,000 (landing pages)</option>
                    <option value="1k-2.5k">$1,000 to $2,500 (full websites)</option>
                    <option value="2.5k-plus">$2,500+ (custom builds)</option>
                    <option value="not-sure">Not sure yet</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
              </Field>

              <div className="sm:col-span-2 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-6">
                <FileHandover
                  files={attachments}
                  onAddFiles={handleAddFiles}
                  onRemoveFile={handleRemoveFile}
                  repoLink={form.repoLink}
                  onRepoLinkChange={(value) => updateField('repoLink', value)}
                  repoLinkError={errors.repoLink}
                />
              </div>

              <div className="sm:col-span-2">
                <Field label="Message" htmlFor="message" error={errors.message}>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    maxLength={MAX_LENGTHS.message}
                    value={form.message}
                    onChange={(e) => updateField('message', e.target.value)}
                    className={fieldInputClass}
                    placeholder="What are you looking to build, and what's not working today?"
                  />
                </Field>
              </div>

              {submitError ? (
                <div className="flex items-start gap-2.5 rounded-[var(--radius-field)] border border-red-400/30 bg-red-400/10 px-4 py-3 sm:col-span-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" strokeWidth={1.75} />
                  <p role="alert" className="text-sm text-red-400">
                    {submitError}
                  </p>
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Sending…' : 'Send Message'}
                </Button>
              </div>
            </form>
          </Reveal>

          <div className="flex flex-col gap-6 lg:col-span-2">
            <Reveal delay={0.1}>
              <GlassPanel className="flex flex-col gap-6 p-8">
                <div className="flex items-start gap-3">
                  <Mail
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
                    strokeWidth={1.75}
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      Email us directly
                    </p>
                    <a
                      href="mailto:muhammadsaqib9117994@gmail.com"
                      className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-accent-soft)]"
                    >
                      muhammadsaqib9117994@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Zap
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
                    strokeWidth={1.75}
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">Response time</p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      Average response time under 2 hours, one business day at the latest.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MessageSquareText
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
                    strokeWidth={1.75}
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      What happens next
                    </p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      We review your project details and reply with clarifying questions or a
                      proposed next step, no sales call required upfront.
                    </p>
                  </div>
                </div>
              </GlassPanel>
            </Reveal>

            <Reveal delay={0.15}>
              <GlassPanel className="p-8">
                <TrustGuarantees />
              </GlassPanel>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.2} className="mt-10 flex items-center justify-center gap-2 text-center">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
            strokeWidth={1.75}
          />
          <p className="text-sm text-[var(--color-ink-muted)]">
            Secure payments via Payoneer, Wise & Bank Transfer.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
