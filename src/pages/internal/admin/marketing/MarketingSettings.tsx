import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CardSkeleton } from '@/components/internal/States'
import { formatWhen, useResource, type AgentSummary, type AuditLogEntry } from '@/lib/marketing'
import { LoadError, Notice, PageHeader, Panel, Tag } from './ui'

interface Settings {
  agent: AgentSummary
  hardRestrictions: string[]
  limits: {
    taskRateLimit: { max: number; windowSeconds: number }
    maxConcurrentTasks: number
    seoAudit: { maxPages: number; maxLinkChecks: number; timeBudgetSeconds: number; maxPageSizeMB: number }
    aiMaxTokens: number
  }
  aiConfigured: boolean
}

export function MarketingSettings() {
  const settings = useResource<Settings>('/admin/marketing/settings')
  const log = useResource<{ entries: AuditLogEntry[] }>('/admin/marketing/audit-log')

  if (settings.loading && !settings.data) return <CardSkeleton count={3} />
  if (settings.error || !settings.data) return <LoadError message={settings.error ?? 'Failed to load settings.'} onRetry={settings.reload} />
  const { agent, hardRestrictions, limits, aiConfigured } = settings.data

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Operating limits and the safety restrictions that apply to this agent. These are enforced by the backend and cannot be changed from the dashboard." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Agent">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">Status</dt>
              <dd>
                <Tag tone={agent.enabled ? 'good' : 'neutral'}>{agent.enabled ? 'Enabled' : 'Disabled'}</Tag>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">Rules version</dt>
              <dd>v{agent.configVersion}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">Last changed</dt>
              <dd className="text-right">
                {formatWhen(agent.updatedAt)}
                <span className="block break-all text-xs text-[var(--color-ink-faint)]">{agent.updatedBy ?? 'unknown'}</span>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">AI provider</dt>
              <dd>
                <Tag tone={aiConfigured ? 'good' : 'warn'}>{aiConfigured ? 'Key configured' : 'Not configured'}</Tag>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm">
            Edit instructions and rules, or switch the agent on or off, under{' '}
            <Link to="/internal/admin/marketing/rules" className="text-[var(--color-accent)] underline">
              Rules &amp; Instructions
            </Link>
            .
          </p>
        </Panel>

        <Panel title="Operating limits" hint="Set by the backend environment.">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">Task starts</dt>
              <dd>
                {limits.taskRateLimit.max} per {limits.taskRateLimit.windowSeconds}s
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">Tasks at once</dt>
              <dd>{limits.maxConcurrentTasks}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">SEO audit crawl</dt>
              <dd className="text-right">
                up to {limits.seoAudit.maxPages} pages, {limits.seoAudit.maxLinkChecks} link checks, {limits.seoAudit.timeBudgetSeconds}s
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">AI output size</dt>
              <dd>{limits.aiMaxTokens.toLocaleString()} tokens</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel title="Hard restrictions" hint="Built into the backend. Rules and instructions cannot override them.">
        <ul className="space-y-2.5 text-sm">
          {hardRestrictions.map((rule) => (
            <li key={rule} className="flex items-start gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Recent activity log" hint="Approvals, status changes, deletions, audits and retries. Content is never logged — only what happened and who did it.">
        {log.loading && !log.data ? <p className="text-sm text-[var(--color-ink-faint)]">Loading…</p> : null}
        {log.error ? <Notice tone="error">{log.error}</Notice> : null}
        {log.data && log.data.entries.length === 0 ? <p className="text-sm text-[var(--color-ink-faint)]">Nothing has been logged yet.</p> : null}
        {log.data && log.data.entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {log.data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-[var(--color-ink-muted)]">{formatWhen(entry.createdAt)}</td>
                    <td className="py-2 pr-3">{entry.action.replace(/[._]/g, ' ')}</td>
                    <td className="py-2 pr-3 break-all text-[var(--color-ink-muted)]">{entry.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
