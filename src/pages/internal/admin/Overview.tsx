import { CheckCircle2, MailCheck, MessageSquareText, Radar, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardSkeleton, ErrorState } from '@/components/internal/States'
import { StatCard } from '@/components/internal/StatCard'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { apiGet, ApiNetworkError } from '@/lib/api'
import type { AdminOverview } from './types'

export function Overview() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    apiGet<AdminOverview>('/admin/overview')
      .then((result) => {
        if (cancelled) return
        if (result.success) setData(result.data ?? null)
        else setError(result.message)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiNetworkError ? err.message : 'Failed to load the dashboard overview.')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <h1 className="text-xl font-semibold">Overview</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Real-time counts across the Client Handling Agent and the Lead Finder Agent.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <CardSkeleton count={8} />
        ) : error ? (
          <ErrorState message={error} />
        ) : data ? (
          <div className="space-y-8">
            <div>
              <SectionLabel icon={Users} label="Across both agents" />
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total leads" value={data.totalLeads} icon={TrendingUp} accent />
                <StatCard label="High priority (Lead Finder)" value={data.leadFinder.highPriorityCount} icon={Radar} />
                <StatCard label="High intent (Client Agent)" value={data.clientAgent.highIntentCount} icon={MessageSquareText} />
                <StatCard label="Converted" value={data.leadFinder.convertedCount} icon={CheckCircle2} />
              </div>
            </div>

            <div>
              <SectionLabel icon={Radar} label="Lead Finder Agent" />
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total" value={data.leadFinder.total} />
                <StatCard label="New" value={data.leadFinder.newCount} />
                <StatCard label="Researched" value={data.leadFinder.researchedCount} />
                <StatCard label="Qualified" value={data.leadFinder.qualifiedCount} />
                <StatCard label="Email drafted" value={data.leadFinder.emailDraftedCount} />
                <StatCard label="Contacted" value={data.leadFinder.contactedCount} />
                <StatCard label="Replied" value={data.leadFinder.repliedCount} />
                <StatCard label="Disqualified" value={data.leadFinder.disqualifiedCount} />
              </div>
            </div>

            <div>
              <SectionLabel icon={MessageSquareText} label="Client Handling Agent" />
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total" value={data.clientAgent.total} />
                <StatCard label="New" value={data.clientAgent.newCount} />
                <StatCard label="In progress" value={data.clientAgent.inProgressCount} />
                <StatCard label="Resolved" value={data.clientAgent.resolvedCount} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ActivityCard title="Recent Lead Finder discoveries">
                {data.recentActivity.recentDiscoveries.length === 0 ? (
                  <EmptyRow />
                ) : (
                  data.recentActivity.recentDiscoveries.map((lead) => (
                    <ActivityRow key={lead.id} to={`/internal/admin/lead-finder/${lead.id}`}>
                      <span className="truncate">{lead.businessName}</span>
                      <span className="text-xs text-[var(--color-ink-faint)]">{lead.opportunityTypes.length} opportunit{lead.opportunityTypes.length === 1 ? 'y' : 'ies'}</span>
                    </ActivityRow>
                  ))
                )}
              </ActivityCard>

              <ActivityCard title="Recent Client Agent conversations">
                {data.recentActivity.recentConversations.length === 0 ? (
                  <EmptyRow />
                ) : (
                  data.recentActivity.recentConversations.map((conv) => (
                    <ActivityRow key={conv.id}>
                      <span className="truncate">{conv.visitorName ?? conv.visitorEmail ?? 'Anonymous visitor'}</span>
                      <StatusBadge value={conv.status} />
                    </ActivityRow>
                  ))
                )}
              </ActivityCard>

              <ActivityCard title="Recent leads (all sources)">
                {data.recentActivity.recentLeads.length === 0 ? (
                  <EmptyRow />
                ) : (
                  data.recentActivity.recentLeads.map((lead) => (
                    <ActivityRow key={lead.id} to={`/internal/admin/lead-finder/${lead.id}`}>
                      <span className="truncate">{lead.businessName}</span>
                      <StatusBadge value={lead.status} />
                    </ActivityRow>
                  ))
                )}
              </ActivityCard>

              <ActivityCard title="Recent outreach" icon={MailCheck}>
                {data.recentActivity.recentOutreach.length === 0 ? (
                  <EmptyRow />
                ) : (
                  data.recentActivity.recentOutreach.map((lead) => (
                    <ActivityRow key={lead.id} to={`/internal/admin/lead-finder/${lead.id}`}>
                      <span className="truncate">{lead.businessName}</span>
                      <span className="text-xs text-[var(--color-ink-faint)]">
                        {lead.gmailDraftId ? 'Draft created' : 'Email generated'}
                      </span>
                    </ActivityRow>
                  ))
                )}
              </ActivityCard>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SectionLabel({ icon: Icon, label }: { icon: typeof Radar; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </div>
  )
}

function ActivityCard({ title, icon: Icon, children }: { title: string; icon?: typeof Radar; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-4 w-4 text-[var(--color-ink-faint)]" strokeWidth={1.75} /> : null}
        {title}
      </div>
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  )
}

function ActivityRow({ children, to }: { children: React.ReactNode; to?: string }) {
  const content = (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] px-2 py-1.5 text-sm">{children}</div>
  )
  if (!to) return content
  return (
    <Link to={to} className="block transition-colors hover:bg-white/[0.03]">
      {content}
    </Link>
  )
}

function EmptyRow() {
  return <p className="px-2 py-1.5 text-xs text-[var(--color-ink-faint)]">Nothing yet.</p>
}
