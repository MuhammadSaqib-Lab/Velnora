/**
 * Mirrors the response of GET /api/admin/counts (backend/src/services/
 * adminCounts.service.ts's `sidebarCountsSchema`). Kept in sync by hand, per
 * this project's frontend/backend duplication convention. A section is `null`
 * when the server could not count it — shown as no badge, never as 0.
 */
export interface SidebarCounts {
  clientAgentLeads: number | null
  leadFinder: number | null
  projects: number | null
  reviews: number | null
  digitalMarketing: number | null
}

export const SIDEBAR_COUNT_KEYS: ReadonlyArray<keyof SidebarCounts> = ['clientAgentLeads', 'leadFinder', 'projects', 'reviews', 'digitalMarketing']

/**
 * Accepts the response only if it has exactly the documented shape (every key
 * present, each a whole non-negative number or null). Anything else is
 * rejected rather than guessed at, so a contract mismatch surfaces as an
 * error state instead of wrong numbers on screen.
 */
export function parseSidebarCounts(value: unknown): SidebarCounts | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== SIDEBAR_COUNT_KEYS.length) return null
  const parsed: Partial<SidebarCounts> = {}
  for (const key of SIDEBAR_COUNT_KEYS) {
    const entry = record[key]
    if (entry === null) parsed[key] = null
    else if (typeof entry === 'number' && Number.isInteger(entry) && entry >= 0) parsed[key] = entry
    else return null
  }
  return parsed as SidebarCounts
}
