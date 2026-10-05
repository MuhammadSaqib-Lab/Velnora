import { History, Loader2, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ErrorState } from '@/components/internal/States'
import { Button } from '@/components/ui/Button'
import { fieldInputClass } from '@/components/ui/fieldStyles'
import { apiGet, apiPatch, apiPost, ApiNetworkError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AgentConfig, AgentConfigVersion, AgentSlug } from './types'

// Mirrors backend/src/validators/agentConfig.validator.ts — the backend is
// the authority, these only drive the counters and the client-side hint.
const MAX_RULES = 6000
const MAX_INSTRUCTIONS = 8000

const AGENTS: Array<{ slug: AgentSlug; label: string; blurb: string }> = [
  {
    slug: 'customer-handler',
    label: 'Customer Handler',
    blurb: 'The website chat consultant that talks to visitors and captures qualified leads.',
  },
  {
    slug: 'lead-finder',
    label: 'Lead Finder',
    blurb: 'The outreach writer that drafts personalized emails for researched businesses.',
  },
]

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Admin Dashboard → Agent Settings. Each agent has its own card with its
 * own Rules and Instructions; the two are never rendered together or
 * loaded into the same state. The tab only decides which card is
 * mounted (`key={slug}` fully resets it), and each card talks to exactly
 * one /api/admin/agents/<slug>/config endpoint.
 *
 * This is behavioral configuration only. Permissions, tool access, rate
 * limits and email-sending restrictions are enforced by the backend and
 * cannot be changed from here.
 */
export function AgentSettings() {
  const [active, setActive] = useState<AgentSlug>('customer-handler')
  const current = AGENTS.find((agent) => agent.slug === active)!

  return (
    <div>
      <h1 className="text-xl font-semibold">Agent Settings</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Edit how each AI agent behaves. Every agent has its own rules and instructions.
      </p>

      <div
        role="note"
        className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-panel)] border border-[var(--color-accent)]/25 bg-[var(--color-accent-dim)] px-4 py-3 text-sm text-[var(--color-ink)]"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
        <span>These settings control this agent&apos;s behavior. Security and permission policies remain enforced by the backend.</span>
      </div>

      <div role="tablist" aria-label="Agents" className="mt-6 flex gap-1 border-b border-white/[0.08]">
        {AGENTS.map((agent) => (
          <button
            key={agent.slug}
            type="button"
            role="tab"
            id={`tab-${agent.slug}`}
            aria-selected={active === agent.slug}
            aria-controls={`panel-${agent.slug}`}
            onClick={() => setActive(agent.slug)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors',
              active === agent.slug
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            {agent.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="mt-6">
        <AgentConfigCard key={active} slug={active} label={current.label} blurb={current.blurb} />
      </div>
    </div>
  )
}

function AgentConfigCard({ slug, label, blurb }: { slug: AgentSlug; label: string; blurb: string }) {
  const base = `/admin/agents/${slug}/config`

  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [rules, setRules] = useState('')
  const [instructions, setInstructions] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [history, setHistory] = useState<AgentConfigVersion[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null)

  const applyConfig = useCallback((next: AgentConfig) => {
    setConfig(next)
    setRules(next.rules)
    setInstructions(next.instructions)
    setEnabled(next.enabled)
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiGet<{ versions: AgentConfigVersion[] }>(`${base}/history`)
      if (res.success) setHistory(res.data?.versions ?? [])
    } catch {
      // History is secondary to the editor; the editor still works without it.
    }
  }, [base])

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await apiGet<AgentConfig>(base)
      if (res.success && res.data) {
        applyConfig(res.data)
        void loadHistory()
      } else {
        setLoadError(res.success ? 'Failed to load configuration.' : res.message)
      }
    } catch (err) {
      setLoadError(err instanceof ApiNetworkError ? err.message : 'Failed to load configuration.')
    } finally {
      setIsLoading(false)
    }
  }, [base, applyConfig, loadHistory])

  useEffect(() => {
    void load()
  }, [load])

  const isDirty = config !== null && (rules !== config.rules || instructions !== config.instructions || enabled !== config.enabled)
  const tooLong = rules.length > MAX_RULES || instructions.length > MAX_INSTRUCTIONS

  async function handleSave() {
    if (!config) return
    setIsSaving(true)
    setNotice(null)
    try {
      const res = await apiPatch<AgentConfig>(base, { rules, instructions, enabled, expectedVersion: config.version })
      if (res.success && res.data) {
        applyConfig(res.data)
        setNotice({ tone: 'ok', text: res.message })
        void loadHistory()
      } else if (!res.success) {
        const detail = res.errors ? ` ${Object.values(res.errors).join(' ')}` : ''
        setNotice({ tone: 'error', text: `${res.message}${detail}` })
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiNetworkError ? err.message : 'Save failed.' })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRestore(version: number) {
    if (!config) return
    setIsSaving(true)
    setNotice(null)
    try {
      const res = await apiPost<AgentConfig>(`${base}/restore`, { version, expectedVersion: config.version })
      if (res.success && res.data) {
        applyConfig(res.data)
        setNotice({ tone: 'ok', text: res.message })
        void loadHistory()
      } else if (!res.success) {
        setNotice({ tone: 'error', text: res.message })
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiNetworkError ? err.message : 'Restore failed.' })
    } finally {
      setIsSaving(false)
      setRestoreTarget(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-ink-faint)]">
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading {label} configuration…
      </div>
    )
  }

  if (loadError || !config) {
    return (
      <div className="space-y-3">
        <ErrorState message={loadError ?? 'Failed to load configuration.'} />
        <Button variant="secondary" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <section aria-label={`${label} configuration`} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-5">
        <header>
          <h2 className="text-lg font-semibold">{config.displayName}</h2>
          <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{blurb}</p>
        </header>

        <label className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm">
            <span className="font-medium">Agent enabled</span>
            <span className="mt-0.5 block text-[var(--color-ink-muted)]">
              {slug === 'customer-handler'
                ? 'When off, the website chat stops answering and points visitors to the contact form.'
                : 'When off, Lead Finder searches, re-analysis, email generation and draft creation are blocked.'}
            </span>
          </span>
        </label>

        <div>
          <label htmlFor={`${slug}-instructions`} className="text-sm font-medium">
            Instructions
          </label>
          <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Who the agent is and how it should work — role, tone and workflow.</p>
          <textarea
            id={`${slug}-instructions`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={14}
            spellCheck
            className={cn(fieldInputClass, 'mt-2 resize-y font-mono leading-relaxed')}
          />
          <Counter value={instructions.length} max={MAX_INSTRUCTIONS} />
        </div>

        <div>
          <label htmlFor={`${slug}-rules`} className="text-sm font-medium">
            Rules
          </label>
          <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Specific do&apos;s and don&apos;ts, one per line. Optional.</p>
          <textarea
            id={`${slug}-rules`}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={10}
            spellCheck
            className={cn(fieldInputClass, 'mt-2 resize-y font-mono leading-relaxed')}
          />
          <Counter value={rules.length} max={MAX_RULES} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleSave()} disabled={!isDirty || isSaving || tooLong}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
            Save Configuration
          </Button>
          {isDirty ? (
            <Button
              variant="ghost"
              onClick={() => {
                applyConfig(config)
                setNotice(null)
              }}
              disabled={isSaving}
            >
              Discard changes
            </Button>
          ) : null}
          {notice ? (
            <p
              role={notice.tone === 'error' ? 'alert' : 'status'}
              className={cn('text-sm', notice.tone === 'error' ? 'text-red-300' : 'text-[var(--color-accent-soft)]')}
            >
              {notice.text}
            </p>
          ) : null}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Configuration status</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">Status</dt>
              <dd>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    config.enabled
                      ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                      : 'border-white/[0.12] bg-white/[0.04] text-[var(--color-ink-muted)]',
                  )}
                >
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">Version</dt>
              <dd>v{config.version}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Last updated</dt>
              <dd className="mt-0.5">{formatDate(config.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Last updated by</dt>
              <dd className="mt-0.5 break-all">{config.updatedBy ?? 'Unknown'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-4">
          <button
            type="button"
            onClick={() => setShowHistory((open) => !open)}
            aria-expanded={showHistory}
            className="flex w-full items-center gap-2 text-left text-sm font-medium"
          >
            <History className="h-4 w-4 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
            Version history
            <span className="ml-auto text-xs text-[var(--color-ink-faint)]">{history.length}</span>
          </button>

          {showHistory ? (
            <ul className="mt-3 space-y-3">
              {history.map((entry) => {
                const isCurrent = entry.version === config.version
                return (
                  <li key={entry.version} className="border-t border-white/[0.06] pt-3 text-xs first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--color-ink)]">
                        v{entry.version} · {entry.changeType.toLowerCase()}
                      </span>
                      {isCurrent ? (
                        <span className="text-[var(--color-accent)]">current</span>
                      ) : restoreTarget === entry.version ? (
                        <span className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleRestore(entry.version)}
                            disabled={isSaving}
                            className="text-[var(--color-accent)] underline disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button type="button" onClick={() => setRestoreTarget(null)} className="text-[var(--color-ink-faint)] underline">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRestoreTarget(entry.version)}
                          disabled={isSaving || isDirty}
                          title={isDirty ? 'Save or discard your edits first' : undefined}
                          className="text-[var(--color-ink-muted)] underline hover:text-[var(--color-ink)] disabled:no-underline disabled:opacity-40"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-[var(--color-ink-faint)]">
                      {formatDate(entry.createdAt)} · {entry.changedBy ?? 'unknown'}
                      {entry.enabled ? '' : ' · disabled'}
                    </p>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {showHistory ? (
            <p className="mt-3 text-xs text-[var(--color-ink-faint)]">Restoring saves the old text as a new version; nothing is deleted.</p>
          ) : null}
        </div>
      </aside>
    </section>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <p className={cn('mt-1 text-right text-xs', value > max ? 'text-red-300' : 'text-[var(--color-ink-faint)]')}>
      {value.toLocaleString()} / {max.toLocaleString()}
    </p>
  )
}
