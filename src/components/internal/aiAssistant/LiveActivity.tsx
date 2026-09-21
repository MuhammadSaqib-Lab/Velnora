import { MailCheck, MessageSquareText, Radar } from 'lucide-react'
import { useMemo } from 'react'
import type { AdminOverview } from '@/pages/internal/admin/types'

interface ActivityItem {
  id: string
  icon: typeof Radar
  agent: string
  detail: string
  timestamp: string
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function buildFeed(overview: AdminOverview): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const lead of overview.recentActivity.recentDiscoveries) {
    items.push({
      id: `discovery-${lead.id}`,
      icon: Radar,
      agent: 'Lead Finder Agent',
      detail: `Discovered ${lead.businessName}`,
      timestamp: lead.createdAt,
    })
  }
  for (const conversation of overview.recentActivity.recentConversations) {
    items.push({
      id: `conversation-${conversation.id}`,
      icon: MessageSquareText,
      agent: 'Customer Handling Agent',
      detail: `Talking with ${conversation.visitorName ?? conversation.visitorEmail ?? 'a visitor'}`,
      timestamp: conversation.createdAt,
    })
  }
  for (const lead of overview.recentActivity.recentOutreach) {
    items.push({
      id: `outreach-${lead.id}`,
      icon: MailCheck,
      agent: 'Lead Finder Agent',
      detail: `${lead.gmailDraftId ? 'Gmail draft created for' : 'Outreach email drafted for'} ${lead.businessName}`,
      timestamp: lead.updatedAt,
    })
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
}

/**
 * Every row here is a real, timestamped database event from the same
 * GET /api/admin/overview data the Overview page already shows — never
 * simulated or invented activity. If the fetch failed, this shows an
 * honest empty/unavailable state instead of a fake feed.
 */
export function LiveActivity({ overview }: { overview: AdminOverview | null }) {
  const feed = useMemo(() => (overview ? buildFeed(overview) : []), [overview])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Live Activity</h2>
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
          <span className={overview ? 'h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]' : 'h-1.5 w-1.5 rounded-full bg-white/20'} />
          {overview ? 'Real-time' : 'Unavailable'}
        </span>
      </div>

      <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-2">
        {feed.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-[var(--color-ink-faint)]">
            {overview ? 'No recent activity yet.' : 'Sign in to see live agent activity.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {feed.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5 rounded-[var(--radius-field)] px-2 py-2 hover:bg-white/[0.03]">
                <item.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--color-ink)]">{item.agent}</p>
                  <p className="truncate text-xs text-[var(--color-ink-muted)]">{item.detail}</p>
                </div>
                <span className="shrink-0 text-[10px] text-[var(--color-ink-faint)]">{formatRelativeTime(item.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
