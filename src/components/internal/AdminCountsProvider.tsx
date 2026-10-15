import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiGet } from '@/lib/api'
import { AdminCountsContext, type AdminCountsValue } from '@/lib/adminCountsContext'
import { CountsPoller, type PollerState } from '@/lib/countsPoller'
import { parseSidebarCounts, type SidebarCounts } from '@/lib/sidebarCounts'

/** Counts are secondary to the page: a slow counts request must never hold anything up for long. */
const COUNTS_REQUEST_TIMEOUT_MS = 15_000

/**
 * Owns the one counts poller for the admin area (periodic polling while the
 * tab is visible, plus an immediate refresh after the admin changes data —
 * see src/lib/countsPoller.ts). Rendered once, by AdminShell, so every page
 * shares one timer and one request instead of each starting its own.
 */
export function AdminCountsProvider({ enabled, onUnauthorized, children }: { enabled: boolean; onUnauthorized: () => void; children: ReactNode }) {
  const [state, setState] = useState<PollerState<SidebarCounts>>({ data: null, status: 'loading', updatedAt: null })
  const pollerRef = useRef<CountsPoller<SidebarCounts> | null>(null)
  const onUnauthorizedRef = useRef(onUnauthorized)
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized
  }, [onUnauthorized])

  useEffect(() => {
    if (!enabled) return
    const poller = new CountsPoller<SidebarCounts>({
      load: async (signal) => {
        const res = await apiGet<unknown>('/admin/counts', undefined, { signal, timeoutMs: COUNTS_REQUEST_TIMEOUT_MS })
        if (res.success) {
          const counts = parseSidebarCounts(res.data)
          if (!counts) throw new Error('Unexpected counts response')
          return { kind: 'ok', data: counts }
        }
        if (res.status === 401) return { kind: 'unauthorized' }
        throw new Error(res.message)
      },
      onState: setState,
      onUnauthorized: () => onUnauthorizedRef.current(),
    })
    pollerRef.current = poller
    poller.start()
    return () => {
      poller.stop()
      pollerRef.current = null
    }
  }, [enabled])

  const value = useMemo<AdminCountsValue>(
    () => ({ counts: state.data, status: state.status, refresh: () => pollerRef.current?.refresh() }),
    [state.data, state.status],
  )
  return <AdminCountsContext.Provider value={value}>{children}</AdminCountsContext.Provider>
}

