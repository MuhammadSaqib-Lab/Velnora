import { Bot, ChevronDown, MessageSquareText, Radar } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { AdminOverview } from '@/pages/internal/admin/types'
import { AGENT_REGISTRY } from './assistantState'

type ConnectionStatus = 'connecting' | 'online' | 'offline'

const AGENT_ICON: Record<string, typeof Radar> = {
  'lead-finder': Radar,
  'client-handling': MessageSquareText,
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

/** "Active" only means real activity landed within the last 10 minutes
 * (per the most recent real timestamp in overview data) — never a
 * fabricated "always working" indicator. */
const ACTIVE_WINDOW_MS = 10 * 60 * 1000

/**
 * Only the two agents that actually exist in this codebase get a card
 * with live status (see assistantState.ts's comment on AGENT_REGISTRY).
 * The Lead Finder's internal pipeline stages (research, website
 * analysis, SEO check, scoring, drafting) are shown as its
 * `capabilities`, not as separate cards with fabricated status — there
 * is no backend entity to honestly report per-stage status for.
 */
export function AgentTeam({ overview, status }: { overview: AdminOverview | null; status: ConnectionStatus }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">Agent Team</h2>
        <span className="text-xs text-[var(--color-ink-faint)]">
          {status === 'online' ? `${AGENT_REGISTRY.length} online` : status === 'connecting' ? 'Connecting…' : 'Unavailable'}
        </span>
      </div>

      {AGENT_REGISTRY.map((agent) => {
        const Icon = AGENT_ICON[agent.id] ?? Bot
        const summary =
          agent.id === 'lead-finder' && overview
            ? `${overview.leadFinder.total} leads · ${overview.leadFinder.highPriorityCount} high priority`
            : agent.id === 'client-handling' && overview
              ? `${overview.clientAgent.total} conversations · ${overview.clientAgent.highIntentCount} high intent`
              : null

        const lastActivityIso =
          agent.id === 'lead-finder'
            ? (overview?.recentActivity.recentDiscoveries[0]?.createdAt ?? overview?.recentActivity.recentOutreach[0]?.updatedAt ?? null)
            : agent.id === 'client-handling'
              ? (overview?.recentActivity.recentConversations[0]?.createdAt ?? null)
              : null

        return (
          <AgentCard
            key={agent.id}
            icon={Icon}
            name={agent.name}
            description={agent.description}
            summary={summary}
            status={status}
            capabilities={agent.capabilities}
            lastActivityIso={lastActivityIso}
          />
        )
      })}
    </div>
  )
}

function AgentCard({
  icon: Icon,
  name,
  description,
  summary,
  status,
  capabilities,
  lastActivityIso,
}: {
  icon: typeof Radar
  name: string
  description: string
  summary: string | null
  status: ConnectionStatus
  capabilities: string[]
  lastActivityIso: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const isActive = status === 'online' && !!lastActivityIso && Date.now() - new Date(lastActivityIso).getTime() < ACTIVE_WINDOW_MS

  return (
    <div
      className={cn(
        'rounded-[var(--radius-panel)] border bg-white/[0.03] p-4 backdrop-blur-xl transition-colors',
        isActive ? 'border-[var(--color-accent)]/35 shadow-[0_0_24px_-8px_rgba(52,211,153,0.4)]' : 'border-white/[0.08]',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-dim)]">
          <Icon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  status === 'online' ? 'bg-[var(--color-accent)]' : status === 'connecting' ? 'bg-amber-400' : 'bg-red-400',
                )}
              />
              <p className="truncate text-sm font-medium text-[var(--color-ink)]">{name}</p>
            </div>
            {status === 'online' ? (
              <span className={cn('shrink-0 text-[10px] font-medium', isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-faint)]')}>
                {isActive ? 'Active' : 'Idle'}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">{description}</p>
          {summary ? <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{summary}</p> : null}
          {lastActivityIso ? (
            <p className="mt-1 text-[10px] text-[var(--color-ink-faint)]">Last activity: {formatRelativeTime(lastActivityIso)}</p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 flex w-full items-center justify-between text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)]"
      >
        Pipeline &amp; capabilities
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} strokeWidth={1.75} />
      </button>

      {expanded ? (
        <ol className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2.5">
          {capabilities.map((capability, i) => (
            <li key={capability} className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] text-[var(--color-ink-faint)]">
                {i + 1}
              </span>
              {capability}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
