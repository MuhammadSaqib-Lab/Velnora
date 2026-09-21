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

        return (
          <AgentCard key={agent.id} icon={Icon} name={agent.name} description={agent.description} summary={summary} status={status} capabilities={agent.capabilities} />
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
}: {
  icon: typeof Radar
  name: string
  description: string
  summary: string | null
  status: ConnectionStatus
  capabilities: string[]
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-dim)]">
          <Icon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                status === 'online' ? 'bg-[var(--color-accent)]' : status === 'connecting' ? 'bg-amber-400' : 'bg-red-400',
              )}
            />
            <p className="truncate text-sm font-medium text-[var(--color-ink)]">{name}</p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">{description}</p>
          {summary ? <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{summary}</p> : null}
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
