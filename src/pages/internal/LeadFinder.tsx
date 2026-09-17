import { Fragment, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiGet, apiPatch, apiPost, ApiNetworkError } from '@/lib/api'
import { useAdminToken } from '@/lib/useAdminToken'
import { cn } from '@/lib/utils'

/**
 * Internal Lead Finder testing interface (Phase 4) — NOT part of the
 * public marketing site. Deliberately minimal: a functional tool for the
 * one human operator to run searches and review/approve AI-drafted
 * outreach, not a designed product. Kept as-is per Phase 5's "do not
 * remove or break Phase 4 functionality" — the full Admin Dashboard at
 * /internal/admin (see src/pages/internal/admin/) is now the primary,
 * comprehensive interface; this page remains available unlinked as a
 * lighter-weight, single-purpose tool.
 *
 * There is no real auth system yet (Phase 3), so this page's only
 * "login" is entering the same shared secret the backend's
 * requireAdminToken.ts checks — stored in sessionStorage, sent as
 * X-Admin-Token on every request. Anyone without that token gets 401s
 * from the API regardless of what this page renders.
 */

const OPPORTUNITY_TYPES = ['NO_WEBSITE', 'OLD_WEBSITE', 'POOR_MOBILE', 'WEAK_SEO', 'AI_AUTOMATION'] as const
const STATUS_OPTIONS = ['QUALIFIED', 'CONTACTED', 'REPLIED', 'NOT_INTERESTED', 'CONVERTED', 'DISQUALIFIED'] as const

interface Lead {
  id: string
  businessName: string
  category?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  sourceUrl?: string | null
  opportunityTypes: string[]
  opportunityScore?: number | null
  priority?: string | null
  status: string
  analysis?: unknown
  evidence?: Record<string, { evidence: string[]; source: string }> | null
  emailSubject?: string | null
  emailBody?: string | null
  gmailDraftId?: string | null
}

export function LeadFinder() {
  const { token, setToken, signOut, headers } = useAdminToken()
  const [tokenInput, setTokenInput] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [count, setCount] = useState(10)
  const [minScore, setMinScore] = useState<number | ''>('')
  const [opportunityFilter, setOpportunityFilter] = useState<string[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)

  useEffect(() => {
    if (token) void loadLeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function loadLeads() {
    try {
      const result = await apiGet<{ leads: Lead[] }>('/leads?pageSize=50', headers)
      if (result.success) setLeads(result.data?.leads ?? [])
      else setMessage(result.message)
    } catch (error) {
      setMessage(error instanceof ApiNetworkError ? error.message : 'Failed to load leads.')
    }
  }

  function toggleOpportunityFilter(type: string) {
    setOpportunityFilter((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  async function handleSearch() {
    if (!industry.trim() || !location.trim()) {
      setMessage('Enter both an industry and a location.')
      return
    }
    setIsSearching(true)
    setMessage(null)
    try {
      const result = await apiPost<{ leads: Lead[]; count: number }>(
        '/leads/search',
        {
          industry: industry.trim(),
          location: location.trim(),
          count,
          ...(minScore !== '' ? { minScore } : {}),
          ...(opportunityFilter.length > 0 ? { opportunityTypes: opportunityFilter } : {}),
        },
        headers,
      )
      setMessage(result.message)
      if (result.success) await loadLeads()
    } catch (error) {
      setMessage(error instanceof ApiNetworkError ? error.message : 'Search failed.')
    } finally {
      setIsSearching(false)
    }
  }

  async function handleGenerateEmail(id: string) {
    setBusyLeadId(id)
    try {
      const result = await apiPost<Lead>(`/leads/${id}/generate-email`, {}, headers)
      setMessage(result.message)
      if (result.success) await loadLeads()
    } catch (error) {
      setMessage(error instanceof ApiNetworkError ? error.message : 'Email generation failed.')
    } finally {
      setBusyLeadId(null)
    }
  }

  async function handleCreateDraft(id: string) {
    setBusyLeadId(id)
    try {
      const result = await apiPost<Lead>(`/leads/${id}/create-draft`, {}, headers)
      setMessage(result.message)
      if (result.success) await loadLeads()
    } catch (error) {
      setMessage(error instanceof ApiNetworkError ? error.message : 'Draft creation failed.')
    } finally {
      setBusyLeadId(null)
    }
  }

  async function handleStatusChange(id: string, status: string) {
    setBusyLeadId(id)
    try {
      const result = await apiPatch<Lead>(`/leads/${id}/status`, { status }, headers)
      setMessage(result.message)
      if (result.success) await loadLeads()
    } catch (error) {
      setMessage(error instanceof ApiNetworkError ? error.message : 'Status update failed.')
    } finally {
      setBusyLeadId(null)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] px-6 py-16 text-[var(--color-ink)]">
        <Helmet>
          <title>Lead Finder (Internal)</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="mx-auto max-w-sm">
          <h1 className="text-lg font-semibold">Lead Finder — Internal</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Enter the Lead Finder admin token (LEAD_FINDER_ADMIN_TOKEN) to continue.
          </p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Admin token"
            className={cn(fieldInputClass, 'mt-4')}
          />
          <Button className="mt-3" onClick={() => setToken(tokenInput.trim())}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] px-6 py-10 text-[var(--color-ink)]">
      <Helmet>
        <title>Lead Finder (Internal)</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Lead Finder — Internal</h1>
          <button type="button" onClick={signOut} className="text-xs text-[var(--color-ink-faint)] underline">
            Sign out
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
          Development/testing interface only — see backend/README.md's "AI Lead Finder Agent" section. No email is
          ever sent automatically; every draft requires manual review and send in Gmail.{' '}
          <Link to="/internal/admin" className="underline decoration-white/30 hover:text-[var(--color-ink)]">
            Open the full Admin Dashboard →
          </Link>
        </p>

        <div className="mt-6 grid gap-3 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5 sm:grid-cols-2">
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Industry (e.g. dentists)"
            className={fieldInputClass}
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (e.g. Lahore)"
            className={fieldInputClass}
          />
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            placeholder="Count (max 20)"
            className={fieldInputClass}
          />
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Minimum score (optional)"
            className={fieldInputClass}
          />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {OPPORTUNITY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleOpportunityFilter(type)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  opportunityFilter.includes(type)
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                    : 'border-white/[0.12] text-[var(--color-ink-faint)]',
                )}
              >
                {type}
              </button>
            ))}
          </div>
          <Button className="sm:col-span-2 justify-center" onClick={handleSearch} disabled={isSearching}>
            {isSearching ? 'Searching…' : 'Search & Research'}
          </Button>
        </div>

        {message ? <p className="mt-4 text-sm text-[var(--color-accent-soft)]">{message}</p> : null}

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-xs uppercase text-[var(--color-ink-faint)]">
                <th className="py-2 pr-3">Business</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Opportunities</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <Fragment key={lead.id}>
                  <tr className="border-b border-white/[0.05] align-top">
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="text-left underline decoration-white/20"
                        onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                      >
                        {lead.businessName}
                      </button>
                      {lead.website ? (
                        <div className="text-xs text-[var(--color-ink-faint)]">{lead.website}</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{lead.category ?? '—'}</td>
                    <td className="py-2 pr-3">
                      {lead.opportunityScore ?? '—'} ({lead.priority ?? '—'})
                    </td>
                    <td className="py-2 pr-3">{lead.opportunityTypes.join(', ') || '—'}</td>
                    <td className="py-2 pr-3">{lead.email ?? 'NO_CONTACT_EMAIL'}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={lead.status}
                        onChange={(e) => void handleStatusChange(lead.id, e.target.value)}
                        disabled={busyLeadId === lead.id}
                        className="rounded border border-white/[0.12] bg-transparent px-1.5 py-1 text-xs"
                      >
                        <option value={lead.status}>{lead.status}</option>
                        {STATUS_OPTIONS.filter((s) => s !== lead.status).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={!lead.email || busyLeadId === lead.id}
                          onClick={() => void handleGenerateEmail(lead.id)}
                          className="text-left text-xs text-[var(--color-accent-soft)] underline disabled:opacity-40"
                        >
                          Generate email
                        </button>
                        <button
                          type="button"
                          disabled={!lead.emailSubject || Boolean(lead.gmailDraftId) || busyLeadId === lead.id}
                          onClick={() => void handleCreateDraft(lead.id)}
                          className="text-left text-xs text-[var(--color-accent-soft)] underline disabled:opacity-40"
                        >
                          {lead.gmailDraftId ? 'Draft created' : 'Create Gmail draft'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === lead.id ? (
                    <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                      <td colSpan={7} className="p-4 text-xs">
                        <p className="text-[var(--color-ink-faint)]">Source: {lead.sourceUrl}</p>
                        <p className="mt-2 font-medium">Evidence</p>
                        <pre className="mt-1 whitespace-pre-wrap text-[var(--color-ink-muted)]">
                          {JSON.stringify(lead.evidence, null, 2)}
                        </pre>
                        {lead.emailSubject ? (
                          <>
                            <p className="mt-3 font-medium">Generated email</p>
                            <p className="mt-1">
                              <strong>Subject:</strong> {lead.emailSubject}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{lead.emailBody}</p>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {leads.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-ink-faint)]">No leads yet — run a search above.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
