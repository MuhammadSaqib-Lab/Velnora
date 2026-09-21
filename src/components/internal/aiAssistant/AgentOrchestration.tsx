import { Bot, FileText, Radar, Search, TrendingUp, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { AssistantState } from './assistantState'

interface OrchestrationNode {
  id: string
  label: string
  icon: typeof Radar
}

const NODES: OrchestrationNode[] = [
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
  { id: 'lead-finder', label: 'Lead Finder', icon: Radar },
  { id: 'research', label: 'Research', icon: Search },
  { id: 'website-analysis', label: 'Website Analysis', icon: Wrench },
  { id: 'seo', label: 'SEO', icon: TrendingUp },
  { id: 'proposal', label: 'Proposal', icon: FileText },
]

/** Which pipeline nodes light up for a given simulated action — reflects
 * what the Lead Finder Agent's REAL service functions actually do (see
 * backend/src/services/leadFinder.service.ts), not an arbitrary mapping. */
const ACTION_NODES: Record<string, string[]> = {
  searchAndResearchLeads: ['lead-finder', 'research', 'website-analysis', 'seo'],
  reanalyzeLead: ['lead-finder', 'website-analysis', 'seo'],
  generateEmailForLead: ['lead-finder', 'proposal'],
  createDraftForLead: ['lead-finder', 'proposal'],
  updateLeadStatus: ['lead-finder'],
}

const ACTIVE_WINDOW_MS = 4000

/** Real, derivable status text — never a fabricated per-stage progress
 * report. The "AI Assistant" node reflects the actual AssistantState;
 * pipeline nodes only say "Working" while they're inside the real
 * ACTIVE_WINDOW_MS after Claude called simulate_agent_action naming
 * them, otherwise "Waiting". */
function assistantNodeStatus(state: AssistantState): string {
  switch (state) {
    case 'idle':
      return 'Waiting'
    case 'listening':
    case 'attentive':
      return 'Listening'
    case 'thinking':
      return 'Analyzing'
    case 'speaking':
      return 'Active'
    case 'working':
      return 'Working'
    case 'success':
    case 'positive':
      return 'Completed'
    case 'concerned':
    case 'caution':
      return 'Error'
    default:
      return 'Waiting'
  }
}

/**
 * An informational diagram of how a request actually flows through this
 * system — not a live per-stage status board, since the backend has no
 * per-stage progress events to report honestly (see leadFinder.service.ts:
 * searchAndResearchLeads runs its pipeline as one call, it doesn't emit
 * "now analyzing website" events). The two things that ARE real here:
 * the "AI Assistant" node's color reflects the actual AssistantState,
 * and nodes briefly highlight right after Claude actually calls
 * simulate_agent_action referencing that part of the pipeline.
 */
export function AgentOrchestration({
  state,
  lastAction,
}: {
  state: AssistantState
  lastAction: { action: string; at: number } | null
}) {
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!lastAction) return
    const remaining = lastAction.at + ACTIVE_WINDOW_MS - Date.now()
    if (remaining <= 0) return
    const timer = setTimeout(() => forceTick((n) => n + 1), remaining)
    return () => clearTimeout(timer)
  }, [lastAction])

  const activeIds = new Set<string>()
  if (lastAction && Date.now() - lastAction.at < ACTIVE_WINDOW_MS) {
    for (const id of ACTION_NODES[lastAction.action] ?? []) activeIds.add(id)
  }
  if (state !== 'idle') activeIds.add('assistant')

  return (
    <div className="rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
        Agent Orchestration
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {NODES.map((node, i) => {
          const active = activeIds.has(node.id)
          const statusText = node.id === 'assistant' ? assistantNodeStatus(state) : active ? 'Working' : 'Waiting'
          return (
            <div key={node.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex flex-col items-center gap-1 rounded-[var(--radius-field)] border px-3 py-2 transition-colors duration-500',
                  active ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-dim)]' : 'border-white/[0.08] bg-white/[0.02]',
                )}
              >
                <node.icon className={cn('h-4 w-4', active ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-faint)]')} strokeWidth={1.75} />
                <span className="whitespace-nowrap text-[11px] text-[var(--color-ink-muted)]">{node.label}</span>
                <span className={cn('whitespace-nowrap text-[9px]', active ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-faint)]')}>
                  {statusText}
                </span>
              </div>
              {i < NODES.length - 1 ? <span className="text-[var(--color-ink-faint)]">→</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
