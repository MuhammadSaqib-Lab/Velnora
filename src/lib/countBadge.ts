/** The most a sidebar badge shows exactly; anything above reads "99+". */
export const BADGE_CAP = 99

/**
 * What a badge displays for a count, or null when there should be no badge:
 * nothing is shown for 0 (an empty queue is not a notification), for an
 * unknown count (null / undefined — the server could not tell, so the badge
 * says nothing rather than a misleading 0), or for anything that is not a
 * whole positive number.
 */
export function formatBadgeCount(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) return null
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count)
}

/** Screen-reader text so the number is never conveyed by shape or colour alone, e.g. "5 new leads". */
export function describeBadge(count: number, singular: string, plural: string): string {
  if (count > BADGE_CAP) return `More than ${BADGE_CAP} ${plural}`
  return `${count} ${count === 1 ? singular : plural}`
}
