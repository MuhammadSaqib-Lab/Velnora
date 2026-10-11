import { CalendarDays, FileText, Megaphone, Search, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatCard } from '@/components/internal/StatCard'
import { CardSkeleton, EmptyState } from '@/components/internal/States'
import { PLATFORM_LABELS, formatDay, formatWhen, label, useResource, type AgentSummary, type AuditSummary, type Draft, type TaskDto } from '@/lib/marketing'
import { Loading, LoadError, Notice, PageHeader, Panel, Tag } from './ui'

interface Overview {
  agent: AgentSummary
  content: Record<string, number>
  campaigns: Record<string, number>
  strategies: Record<string, number>
  upcomingContent: Draft[]
  latestAudit: { id: string; domain: string; url: string; kind: string; createdAt: string; summary: AuditSummary } | null
  recentTasks: TaskDto[]
}

const sum = (o: Record<string, number>, keys: string[]) => keys.reduce((n, k) => n + (o[k] ?? 0), 0)

export function MarketingOverview() {
  const { data, error, loading, reload } = useResource<Overview>('/admin/marketing/overview')

  if (loading && !data) return <CardSkeleton count={4} />
  if (error || !data) return <LoadError message={error ?? 'Failed to load the overview.'} onRetry={reload} />

  const audit = data.latestAudit
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Live counts from the database. Nothing on this page is estimated." />

      {!data.agent.enabled ? (
        <Notice tone="warn">
          The Digital Marketing agent is switched off. Generation tasks are blocked until it is enabled under <Link to="/internal/admin/marketing/rules" className="underline">Rules &amp; Instructions</Link>. Your saved drafts and reports are still available.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Drafts to review" value={data.content.IN_REVIEW ?? 0} icon={FileText} accent />
        <StatCard label="Approved content" value={data.content.APPROVED ?? 0} icon={CalendarDays} />
        <StatCard label="Active campaigns" value={data.campaigns.ACTIVE ?? 0} icon={Megaphone} />
        <StatCard label="Approved plans" value={data.strategies.APPROVED ?? 0} icon={Target} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest SEO audit">
          {audit ? (
            <div className="space-y-2 text-sm">
              <p className="break-all font-medium">{audit.domain}</p>
              <p className="text-[var(--color-ink-faint)]">
                {label(audit.kind)} · {formatWhen(audit.createdAt)} · {audit.summary.pagesCrawled ?? '?'} pages checked
              </p>
              <p className="flex flex-wrap gap-2">
                <Tag tone="bad">{audit.summary.results?.FAIL ?? 0} failing</Tag>
                <Tag tone="warn">{audit.summary.results?.WARN ?? 0} warnings</Tag>
                <Tag tone="good">{audit.summary.results?.PASS ?? 0} passing</Tag>
              </p>
              <Link to={`/internal/admin/marketing/seo?audit=${audit.id}`} className="inline-flex items-center gap-1.5 text-[var(--color-accent)] underline">
                <Search className="h-3.5 w-3.5" strokeWidth={1.75} /> Open report
              </Link>
            </div>
          ) : (
            <EmptyState message="No SEO audits yet. Run one from the SEO Workspace." />
          )}
        </Panel>

        <Panel title="Upcoming planned content" hint="Planned dates are reminders only — nothing is published automatically.">
          {data.upcomingContent.length === 0 ? (
            <EmptyState message="No content has a planned date yet." />
          ) : (
            <ul className="divide-y divide-white/[0.06] text-sm">
              {data.upcomingContent.map((draft) => (
                <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{PLATFORM_LABELS[draft.platform]}</span> · {draft.title ?? draft.body.slice(0, 50)}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[var(--color-ink-faint)]">
                    {formatDay(draft.plannedFor)} <Tag>{label(draft.status)}</Tag>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Content pipeline">
          <dl className="space-y-1.5 text-sm">
            {['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'].map((status) => (
              <div key={status} className="flex justify-between">
                <dt className="text-[var(--color-ink-muted)]">{label(status)}</dt>
                <dd className="tabular-nums">{data.content[status] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Campaigns">
          <dl className="space-y-1.5 text-sm">
            {['DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].map((status) => (
              <div key={status} className="flex justify-between">
                <dt className="text-[var(--color-ink-muted)]">{label(status)}</dt>
                <dd className="tabular-nums">{data.campaigns[status] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">{sum(data.campaigns, ['ACTIVE', 'PLANNED'])} planned or active. “Active” is a label — it starts nothing anywhere.</p>
        </Panel>
        <Panel title="Plans & strategies">
          <dl className="space-y-1.5 text-sm">
            {['DRAFT', 'APPROVED', 'ARCHIVED'].map((status) => (
              <div key={status} className="flex justify-between">
                <dt className="text-[var(--color-ink-muted)]">{label(status)}</dt>
                <dd className="tabular-nums">{data.strategies[status] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Recent tasks">
        {loading ? <Loading /> : null}
        {data.recentTasks.length === 0 ? (
          <EmptyState message="No tasks have run yet." />
        ) : (
          <ul className="divide-y divide-white/[0.06] text-sm">
            {data.recentTasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <span>{label(task.type)}</span>
                <span className="flex items-center gap-2 text-xs text-[var(--color-ink-faint)]">
                  {formatWhen(task.createdAt)}
                  <Tag tone={task.status === 'COMPLETED' ? 'good' : task.status === 'FAILED' ? 'bad' : 'neutral'}>{label(task.status)}</Tag>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/internal/admin/marketing/tasks" className="mt-3 inline-block text-sm text-[var(--color-accent)] underline">
          View all tasks
        </Link>
      </Panel>
    </div>
  )
}
