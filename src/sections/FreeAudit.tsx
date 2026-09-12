import { CheckCircle2, ScanSearch } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Reveal } from '@/components/ui/Reveal'
import { auditBenefits } from '@/data/audit'
import { submitAuditRequest, validateAuditForm, type AuditFormData, type AuditFormErrors } from '@/lib/audit'
import { MAX_LENGTHS } from '@/lib/validation'

const initialForm: AuditFormData = { url: '', email: '' }

export function FreeAudit() {
  const [form, setForm] = useState<AuditFormData>(initialForm)
  const [errors, setErrors] = useState<AuditFormErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')

  function updateField(key: keyof AuditFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateAuditForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setStatus('submitting')
    await submitAuditRequest(form)
    setStatus('success')
  }

  return (
    <section id="free-audit" className="py-28 md:py-36">
      <div className="container-app grid items-center gap-16 lg:grid-cols-2">
        <Reveal>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)]">
            <ScanSearch className="h-5 w-5 text-[var(--color-accent)]" strokeWidth={1.75} />
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance text-[var(--color-ink)] md:text-4xl">
            Get a free SEO and performance audit
          </h2>
          <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-[var(--color-ink-muted)]">
            See exactly what's slowing your site down and where you're losing search visibility.
            No cost, no obligation.
          </p>
          <ul className="mt-6 space-y-3">
            {auditBenefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  strokeWidth={1.75}
                />
                <span className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <GlassPanel className="p-8">
            {status === 'success' ? (
              <div className="text-center">
                <CheckCircle2
                  className="mx-auto h-10 w-10 text-[var(--color-accent)]"
                  strokeWidth={1.5}
                />
                <h3 className="mt-4 text-lg font-semibold text-[var(--color-ink)]">
                  Request received
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  We'll email your free audit to {form.email} within two business days.
                </p>
                <Button
                  variant="secondary"
                  className="mt-6"
                  onClick={() => {
                    setForm(initialForm)
                    setErrors({})
                    setStatus('idle')
                  }}
                >
                  Request another audit
                </Button>
              </div>
            ) : (
              <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Field label="Website URL" htmlFor="audit-url" error={errors.url}>
                  <input
                    id="audit-url"
                    name="url"
                    type="url"
                    autoComplete="url"
                    maxLength={MAX_LENGTHS.url}
                    value={form.url}
                    onChange={(e) => updateField('url', e.target.value)}
                    className={fieldInputClass}
                    placeholder="https://yourwebsite.com"
                  />
                </Field>

                <Field label="Email" htmlFor="audit-email" error={errors.email}>
                  <input
                    id="audit-email"
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

                <Button
                  type="submit"
                  size="lg"
                  className="w-full justify-center"
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Sending…' : 'Get My Free Audit'}
                </Button>
              </form>
            )}
          </GlassPanel>
        </Reveal>
      </div>
    </section>
  )
}
