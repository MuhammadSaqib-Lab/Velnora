import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, TableSkeleton } from '@/components/internal/States'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiGet, apiPatch, ApiNetworkError } from '@/lib/api'
import type { ClientLead, ConversationDetail } from './types'

const STATUS_OPTIONS = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED']

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--color-ink)]">{value ?? '—'}</p>
    </div>
  )
}

export function ClientLeadDetail() {
  const { id } = useParams<{ id: string }>()
  const [lead, setLead] = useState<ClientLead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [conversationError, setConversationError] = useState<string | null>(null)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [showConversation, setShowConversation] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setIsLoading(true)
    apiGet<ClientLead>(`/admin/client-leads/${id}`)
      .then((res) => {
        if (cancelled) return
        if (res.success) setLead(res.data ?? null)
        else setError(res.message)
      })
      .catch((err) => !cancelled && setError(err instanceof ApiNetworkError ? err.message : 'Failed to load this lead.'))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleStatusChange(status: string) {
    if (!id) return
    setIsUpdating(true)
    setMessage(null)
    try {
      const res = await apiPatch<ClientLead>(`/admin/client-leads/${id}/status`, { status })
      if (res.success) {
        setLead(res.data ?? null)
        setMessage(res.message)
      } else {
        setMessage(res.message)
      }
    } catch (err) {
      setMessage(err instanceof ApiNetworkError ? err.message : 'Status update failed.')
    } finally {
      setIsUpdating(false)
    }
  }

  async function loadConversation() {
    if (!id || conversation) {
      setShowConversation((prev) => !prev)
      return
    }
    setIsLoadingConversation(true)
    setConversationError(null)
    try {
      const res = await apiGet<ConversationDetail>(`/admin/client-leads/${id}/conversation`)
      if (res.success) {
        setConversation(res.data ?? null)
        setShowConversation(true)
      } else {
        setConversationError(res.message)
      }
    } catch (err) {
      setConversationError(err instanceof ApiNetworkError ? err.message : 'Failed to load the conversation.')
    } finally {
      setIsLoadingConversation(false)
    }
  }

  return (
    <div>
      <Link to="/internal/admin/client-leads" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to Client Agent Leads
      </Link>

      <div className="mt-4">
        {isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : error ? (
          <ErrorState message={error} />
        ) : lead ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{lead.name}</h1>
                <p className="text-sm text-[var(--color-ink-faint)]">{lead.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={lead.intent} />
                <select
                  value={lead.status}
                  disabled={isUpdating}
                  onChange={(e) => void handleStatusChange(e.target.value)}
                  className={fieldInputClass}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {message ? <p className="text-sm text-[var(--color-accent-soft)]">{message}</p> : null}

            <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="text-sm font-medium text-[var(--color-ink-faint)]">Business Information</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Company" value={lead.company} />
                <Field label="Website" value={lead.website} />
                <Field label="Phone" value={lead.phone} />
                <Field label="Requested service" value={lead.service} />
                <Field label="Budget" value={lead.budget} />
                <Field label="Timeline" value={lead.timeline} />
                <Field label="Created" value={new Date(lead.createdAt).toLocaleString()} />
              </div>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">Requirements</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-ink)]">{lead.requirements}</p>
              </div>
            </div>

            <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-[var(--color-ink-faint)]">Conversation</h2>
                <button
                  type="button"
                  onClick={loadConversation}
                  disabled={isLoadingConversation}
                  className="text-xs text-[var(--color-accent-soft)] underline disabled:opacity-50"
                >
                  {isLoadingConversation ? 'Loading…' : showConversation ? 'Hide transcript' : 'View transcript'}
                </button>
              </div>
              {conversationError ? <div className="mt-3"><ErrorState message={conversationError} /></div> : null}
              {showConversation && conversation ? (
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto rounded-[var(--radius-field)] border border-white/[0.08] bg-black/20 p-3">
                  {conversation.messages.map((m) => (
                    <div key={m.id} className={m.role === 'USER' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-muted)]'}>
                      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{m.role}: </span>
                      <span className="whitespace-pre-wrap text-sm">{m.content}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
