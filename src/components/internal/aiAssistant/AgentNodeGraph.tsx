import { Bot, MessageSquareText, Radar } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AdminOverview } from '@/pages/internal/admin/types'

type ConnectionStatus = 'connecting' | 'online' | 'offline'

/**
 * Real status, not decorative: "online" means GET /api/admin/overview
 * actually returned data for that agent just now, and the counts shown
 * are the same real aggregates the Overview page shows — no fabricated
 * activity or fake pulsing "processing" states.
 */
export function AgentNodeGraph() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    let cancelled = false
    apiGet<AdminOverview>('/admin/overview')
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setOverview(result.data)
          setStatus('online')
        } else {
          setStatus('offline')
        }
      })
      .catch(() => {
        if (cancelled) return
        setStatus('offline')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-0">
      <AgentNode icon={Radar} label="Lead Finder Agent" status={status}>
        {overview ? `${overview.leadFinder.total} leads · ${overview.leadFinder.highPriorityCount} high priority` : null}
      </AgentNode>

      <Connector status={status} />

      <AgentNode icon={Bot} label="AI Assistant" status="online" primary>
        Master controller
      </AgentNode>

      <Connector status={status} />

      <AgentNode icon={MessageSquareText} label="Client Handling Agent" status={status}>
        {overview ? `${overview.clientAgent.total} conversations · ${overview.clientAgent.highIntentCount} high intent` : null}
      </AgentNode>
    </div>
  )
}

function Connector({ status }: { status: ConnectionStatus }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'h-8 w-px sm:h-px sm:w-12',
        status === 'online' ? 'bg-[var(--color-accent)]/40' : 'bg-white/[0.1]',
      )}
    />
  )
}

function AgentNode({
  icon: Icon,
  label,
  status,
  primary,
  children,
}: {
  icon: typeof Radar
  label: string
  status: ConnectionStatus
  primary?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-[180px] flex-col items-center gap-2 rounded-[var(--radius-panel)] border px-5 py-4 text-center',
        primary
          ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-dim)]'
          : 'border-white/[0.08] bg-white/[0.02]',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.75} />
        <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            status === 'online' ? 'bg-[var(--color-accent)]' : status === 'connecting' ? 'bg-amber-400' : 'bg-red-400',
          )}
        />
        {status === 'online' ? 'Online' : status === 'connecting' ? 'Connecting…' : 'Unavailable'}
      </div>
      {children ? <p className="text-xs text-[var(--color-ink-muted)]">{children}</p> : null}
    </div>
  )
}
