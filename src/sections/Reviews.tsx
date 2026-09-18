import { AlertCircle, CheckCircle2, MessageSquareQuote } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { StarRatingDisplay, StarRatingInput } from '@/components/ui/StarRating'
import { ApiNetworkError, apiGet, apiPost } from '@/lib/api'
import { MAX_LENGTHS } from '@/lib/validation'
import {
  validateReviewForm,
  type PublicReviewsResponse,
  type ReviewFormData,
  type ReviewFormErrors,
} from '@/lib/reviews'

const initialForm: ReviewFormData = { name: '', email: '', rating: 0, reviewText: '' }
const DISTRIBUTION_ORDER = ['5', '4', '3', '2', '1'] as const

export function Reviews() {
  const [data, setData] = useState<PublicReviewsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<ReviewFormData>(initialForm)
  const [errors, setErrors] = useState<ReviewFormErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  function loadReviews() {
    apiGet<PublicReviewsResponse>('/reviews')
      .then((res) => {
        if (res.success) setData(res.data ?? null)
        else setLoadError(res.message)
      })
      .catch((err) => setLoadError(err instanceof ApiNetworkError ? err.message : 'Could not load reviews right now.'))
  }

  useEffect(() => {
    loadReviews()
  }, [])

  function updateField<K extends keyof ReviewFormData>(key: K, value: ReviewFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateReviewForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitError(null)
    setStatus('submitting')

    try {
      const result = await apiPost('/reviews', {
        name: form.name,
        email: form.email || undefined,
        rating: form.rating,
        reviewText: form.reviewText,
      })

      if (result.success) {
        setStatus('success')
        return
      }

      if (result.errors) {
        setErrors({
          name: result.errors.name,
          email: result.errors.email,
          rating: result.errors.rating,
          reviewText: result.errors.reviewText,
        })
      } else {
        setSubmitError(result.message)
      }
      setStatus('idle')
    } catch (error) {
      setSubmitError(error instanceof ApiNetworkError ? error.message : 'Something went wrong. Please try again shortly.')
      setStatus('idle')
    }
  }

  const summary = data?.summary
  const reviews = data?.reviews ?? []

  return (
    <section id="reviews" className="py-28 md:py-36">
      <div className="container-app">
        <SectionHeading
          eyebrow="Client Reviews"
          heading="What our clients say"
          subtext="Real feedback from clients we've worked with, published after a quick moderation check."
        />

        {summary && summary.total > 0 ? (
          <Reveal delay={0.05} className="mt-10">
            <GlassPanel className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
              <div className="flex items-center gap-4">
                <span className="text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
                  {summary.average?.toFixed(1)}
                </span>
                <div>
                  <StarRatingDisplay rating={summary.average ?? 0} />
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    Based on {summary.total} {summary.total === 1 ? 'review' : 'reviews'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 sm:w-56">
                {DISTRIBUTION_ORDER.map((star) => {
                  const count = summary.distribution[star]
                  const pct = summary.total > 0 ? (count / summary.total) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs text-[var(--color-ink-faint)]">
                      <span className="w-3 text-right">{star}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-4 tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>
            </GlassPanel>
          </Reveal>
        ) : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {loadError ? (
              <p role="alert" className="text-sm text-red-400">
                {loadError}
              </p>
            ) : reviews.length === 0 ? (
              <Reveal className="flex flex-col items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-white/[0.12] px-6 py-16 text-center">
                <MessageSquareQuote className="h-6 w-6 text-[var(--color-ink-faint)]" strokeWidth={1.5} />
                <p className="text-sm text-[var(--color-ink-faint)]">
                  No reviews yet — be the first to share your experience working with us.
                </p>
              </Reveal>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2">
                {reviews.map((review, i) => (
                  <Reveal key={review.id} as="li" delay={Math.min(i, 4) * 0.05}>
                    <GlassPanel className="flex h-full flex-col gap-4 p-6">
                      <StarRatingDisplay rating={review.rating} size="sm" />
                      <p className="flex-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                        &ldquo;{review.reviewText}&rdquo;
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--color-ink)]">{review.name}</p>
                        <time dateTime={review.createdAt} className="text-xs text-[var(--color-ink-faint)]">
                          {new Date(review.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                        </time>
                      </div>
                    </GlassPanel>
                  </Reveal>
                ))}
              </ul>
            )}
          </div>

          <Reveal delay={0.1} className="lg:col-span-2">
            <GlassPanel className="p-6 md:p-8">
              {status === 'success' ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-9 w-9 text-[var(--color-accent)]" strokeWidth={1.5} />
                  <h3 className="text-lg font-semibold text-[var(--color-ink)]">Thanks for the feedback!</h3>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    Your review will appear here once it's been reviewed by our team.
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-2"
                    onClick={() => {
                      setForm(initialForm)
                      setErrors({})
                      setSubmitError(null)
                      setStatus('idle')
                    }}
                  >
                    Leave another review
                  </Button>
                </div>
              ) : (
                <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
                  <h3 className="text-base font-semibold text-[var(--color-ink)]">Share your experience</h3>

                  <div>
                    <span className="mb-2 block text-sm font-medium text-[var(--color-ink)]">Rating</span>
                    <StarRatingInput value={form.rating} onChange={(v) => updateField('rating', v)} error={errors.rating} />
                  </div>

                  <Field label="Name" htmlFor="review-name" error={errors.name}>
                    <input
                      id="review-name"
                      type="text"
                      autoComplete="name"
                      maxLength={MAX_LENGTHS.name}
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className={fieldInputClass}
                      placeholder="Jordan Ashworth"
                    />
                  </Field>

                  <Field label="Email" htmlFor="review-email" optional error={errors.email}>
                    <input
                      id="review-email"
                      type="email"
                      autoComplete="email"
                      maxLength={MAX_LENGTHS.email}
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className={fieldInputClass}
                      placeholder="you@company.com"
                    />
                  </Field>

                  <Field label="Review" htmlFor="review-text" error={errors.reviewText}>
                    <textarea
                      id="review-text"
                      rows={4}
                      maxLength={MAX_LENGTHS.reviewText}
                      value={form.reviewText}
                      onChange={(e) => updateField('reviewText', e.target.value)}
                      className={fieldInputClass}
                      placeholder="What was it like working with Velnora?"
                    />
                  </Field>

                  {submitError ? (
                    <div className="flex items-start gap-2.5 rounded-[var(--radius-field)] border border-red-400/30 bg-red-400/10 px-4 py-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" strokeWidth={1.75} />
                      <p role="alert" className="text-sm text-red-400">
                        {submitError}
                      </p>
                    </div>
                  ) : null}

                  <Button type="submit" disabled={status === 'submitting'} className="w-full justify-center">
                    {status === 'submitting' ? 'Submitting…' : 'Submit review'}
                  </Button>
                </form>
              )}
            </GlassPanel>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
