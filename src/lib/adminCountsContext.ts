import { createContext, useContext } from 'react'
import type { PollerStatus } from '@/lib/countsPoller'
import type { SidebarCounts } from '@/lib/sidebarCounts'

export interface AdminCountsValue {
  counts: SidebarCounts | null
  status: PollerStatus
  /** Re-fetch now (coalesced with any request already running). */
  refresh: () => void
}

export const AdminCountsContext = createContext<AdminCountsValue>({ counts: null, status: 'loading', refresh: () => {} })

export function useAdminCounts(): AdminCountsValue {
  return useContext(AdminCountsContext)
}
