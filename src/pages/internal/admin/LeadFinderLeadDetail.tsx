import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, TableSkeleton } from '@/components/internal/States'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiGet, apiPatch, apiPost, ApiNetworkError } from '@/lib/api'
import { isSafeHttpUrl } from '@/lib/validation'
import type { LeadFinderLead } from './types'

const STATUS_OPTIONS = ['QUALIFIED', 'CONTACTED', 'REPLIED', 'NOT_INTERESTED', 'CONVERTED', 'DISQUALIFIED']

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--color-ink)]">{value ?? '—'}</p>
    </div>
  )
}

function BooleanFact({ label, ok }: { label: string; ok?: boolean }) {
  if (ok === undefined) return null
  return (
    <li className={ok ? 'text-[var(--color-ink-muted)]' : 'text-red-300'}>
      {ok ? '✓' : '✕'} {label}
    </li>
  )
}

export function LeadFinderLeadDetail() {
  const { id } = useParams<{ id: string }>()
  const [lead, setLead] = useState<LeadFinderLead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [confirmDuplicateDraft, setConfirmDuplicateDraft] = useState(false)

  async function load() {
    if (!id) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiGet<LeadFinderLead>(`/leads/${id}`)
      if (res.success) setLead(res.data ?? null)
      else setError(res.message)
    } catch (err) {
      setError(err instanceof ApiNetworkError ? err.message : 'Failed to load this lead.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleStatusChange(status: string) {
    if (!id) return
    setIsBusy(true)
    setMessage(null)
    try {
      const res = await apiPatch<LeadFinderLead>(`/leads/${id}/status`, { status })
      setMessage(res.message)
      if (res.success) setLead(res.data ?? null)
    } catch (err) {
      setMessage(err instanceof ApiNetworkError ? err.message : 'Status update failed.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleGenerateEmail() {
    if (!id) return
    setIsBusy(true)
    setMessage(null)
    try {
      const res = await apiPost<LeadFinderLead>(`/leads/${id}/generate-email`, {})
      setMessage(res.message)
      if (res.success) setLead(res.data ?? null)
    } catch (err) {
      setMessage(err instanceof ApiNetworkError ? err.message : 'Email generation failed.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleCreateDraft(force = false) {
    if (!id) return
    setIsBusy(true)
    setMessage(null)
    try {
      // The "already has a draft?" check happens client-side before this
      // is ever called (see the button below) — force only needs to
      // reflect the user's explicit confirmation choice. If state is
      // stale (e.g. another tab already created one), the backend's own
      // 409 message still surfaces here safely, just without
      // re-triggering the confirmation UI automatically.
      const res = await apiPost<LeadFinderLead>(`/leads/${id}/create-draft`, { force })
      setMessage(res.message)
      if (res.success) {
        setLead(res.data ?? null)
        setConfirmDuplicateDraft(false)
      }
    } catch (err) {
      setMessage(err instanceof ApiNetworkError ? err.message : 'Draft creation failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const analysis = lead?.analysis?.website

  return (
    <div>
      <Link to="/internal/admin/lead-finder" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to Lead Finder
      </Link>

      <div className="mt-4">
        {isLoading ? (
          <TableSkeleton rows={5} columns={3} />
        ) : error ? (
          <ErrorState message={error} />
        ) : lead ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{lead.businessName}</h1>
                <p className="text-sm text-[var(--color-ink-faint)]">{lead.category ?? 'Uncategorized'} · {lead.location ?? 'Unknown location'}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={lead.status} />
                <select
                  defaultValue=""
                  disabled={isBusy}
                  onChange={(e) => {
                    if (e.target.value) void handleStatusChange(e.target.value)
                    e.target.value = ''
                  }}
                  className={fieldInputClass}
                >
                  <option value="" disabled>
                    Change status…
                  </option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {message ? <p className="text-sm text-[var(--color-accent-soft)]">{message}</p> : null}

            <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="text-sm font-medium text-[var(--color-ink-faint)]">Business Information</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Website" value={lead.website} />
                <Field label="Domain" value={lead.domain} />
                <Field label="Email" value={lead.email ?? 'NO_CONTACT_EMAIL'} />
                <Field label="Phone" value={lead.phone} />
                <Field label="Source" value={lead.source} />
                <Field
                  label="Source link"
                  value={
                    // sourceUrl originates from an external listing (Google
                    // Places today) — treated as untrusted the same as any
                    // other research data, not rendered as a clickable
                    // link unless it's a genuine http(s) URL.
                    lead.sourceUrl && isSafeHttpUrl(lead.sourceUrl) ? (
                      <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20">
                        View listing
                      </a>
                    ) : (
                      lead.sourceUrl
                    )
                  }
                />
                <Field label="Discovered" value={new Date(lead.createdAt).toLocaleString()} />
              </div>
            </section>

            <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="text-sm font-medium text-[var(--color-ink-faint)]">Research Findings</h2>
              {!lead.website ? (
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">No official website was found in the available research.</p>
              ) : !analysis?.fetched ? (
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{analysis?.fetchError ?? 'The website could not be reached during automated research.'}</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  <BooleanFact label="Responsive viewport meta tag" ok={analysis.hasViewportMeta} />
                  <BooleanFact label="Canonical link tag" ok={analysis.hasCanonical} />
                  <BooleanFact label="Structured data (JSON-LD)" ok={analysis.hasStructuredData} />
                  <BooleanFact label="Clear contact call-to-action" ok={analysis.hasContactCta} />
                  <BooleanFact label="Chat or booking widget detected" ok={analysis.hasChatOrBookingWidget} />
                  <BooleanFact label="robots.txt found" ok={analysis.robotsTxtFound} />
                  <BooleanFact label="sitemap.xml found" ok={analysis.sitemapFound} />
                  {analysis.title ? <li className="text-[var(--color-ink-muted)]">Title: “{analysis.title}”</li> : null}
                  {typeof analysis.imgTotal === 'number' ? (
                    <li className="text-[var(--color-ink-muted)]">
                      Images with alt text: {analysis.imgWithAlt ?? 0} of {analysis.imgTotal}
                    </li>
                  ) : null}
                </ul>
              )}

              <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
                Opportunities & evidence
              </h3>
              {lead.opportunityTypes.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--color-ink-faint)]">None identified.</p>
              ) : (
                <div className="mt-2 space-y-3">
                  {lead.opportunityTypes.map((type) => (
                    <div key={type}>
                      <StatusBadge value={type} />
                      <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-ink-muted)]">
                        {(lead.evidence?.[type]?.evidence ?? []).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                      {lead.evidence?.[type]?.source ? (
                        <p className="pl-5 text-xs text-[var(--color-ink-faint)]">Source: {lead.evidence[type].source}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="text-sm font-medium text-[var(--color-ink-faint)]">Scoring</h2>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-semibold text-[var(--color-accent)]">{lead.scoreBreakdown?.score ?? lead.opportunityScore ?? '—'}</span>
                {lead.priority ? <StatusBadge value={lead.priority} /> : null}
              </div>
              {lead.scoreBreakdown?.reasons && lead.scoreBreakdown.reasons.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--color-ink-muted)]">
                  {lead.scoreBreakdown.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="text-sm font-medium text-[var(--color-ink-faint)]">Outreach</h2>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                No email is ever sent automatically. Generate a draft, review it, then send it manually from Gmail.
              </p>

              {!lead.email ? (
                <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
                  This lead has no verified contact email (NO_CONTACT_EMAIL) — an email cannot be generated.
                </p>
              ) : (
                <>
                  {lead.emailSubject ? (
                    <div className="mt-3 rounded-[var(--radius-field)] border border-white/[0.08] bg-black/20 p-3">
                      <p className="text-sm font-medium">{lead.emailSubject}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-ink-muted)]">{lead.emailBody}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--color-ink-faint)]">No email generated yet.</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="secondary" onClick={handleGenerateEmail} disabled={isBusy}>
                      {lead.emailSubject ? 'Regenerate email' : 'Generate email'}
                    </Button>
                    <Button
                      onClick={() => (lead.gmailDraftId ? setConfirmDuplicateDraft(true) : void handleCreateDraft())}
                      disabled={isBusy || !lead.emailSubject}
                    >
                      {lead.gmailDraftId ? 'Create another draft' : 'Create Gmail draft'}
                    </Button>
                    {lead.gmailDraftId ? (
                      <span className="text-xs text-[var(--color-ink-faint)]">Draft already created (id: {lead.gmailDraftId})</span>
                    ) : null}
                  </div>

                  {confirmDuplicateDraft ? (
                    <div className="mt-3 rounded-[var(--radius-field)] border border-amber-400/25 bg-amber-400/[0.06] p-3 text-sm text-amber-200">
                      <p>
                        A Gmail draft already exists for this lead (id: {lead.gmailDraftId}). Create another one anyway?
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button size="md" onClick={() => void handleCreateDraft(true)} disabled={isBusy}>
                          Yes, create another
                        </Button>
                        <Button size="md" variant="ghost" onClick={() => setConfirmDuplicateDraft(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
