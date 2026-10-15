import { describe, expect, it } from 'vitest'
import { BADGE_CAP, describeBadge, formatBadgeCount } from './countBadge'
import { parseSidebarCounts } from './sidebarCounts'

describe('formatBadgeCount — what the sidebar badge shows', () => {
  it('shows the plain number for small counts', () => {
    expect(formatBadgeCount(1)).toBe('1')
    expect(formatBadgeCount(5)).toBe('5')
    expect(formatBadgeCount(24)).toBe('24')
    expect(formatBadgeCount(99)).toBe('99')
  })

  it('caps at 99+ so a pill never grows unbounded', () => {
    expect(BADGE_CAP).toBe(99)
    expect(formatBadgeCount(100)).toBe('99+')
    expect(formatBadgeCount(150)).toBe('99+')
    expect(formatBadgeCount(1_000_000)).toBe('99+')
  })

  it('shows no badge for an empty queue', () => {
    expect(formatBadgeCount(0)).toBeNull()
  })

  it('shows no badge — not a 0 — when the count is unknown', () => {
    expect(formatBadgeCount(null)).toBeNull()
    expect(formatBadgeCount(undefined)).toBeNull()
  })

  it('refuses nonsense instead of displaying it', () => {
    expect(formatBadgeCount(-3)).toBeNull()
    expect(formatBadgeCount(2.5)).toBeNull()
    expect(formatBadgeCount(Number.NaN)).toBeNull()
    expect(formatBadgeCount(Number.POSITIVE_INFINITY)).toBeNull()
    expect(formatBadgeCount('5' as unknown as number)).toBeNull()
  })
})

describe('describeBadge — the sentence a screen reader hears', () => {
  it('uses the singular for one and the plural otherwise', () => {
    expect(describeBadge(1, 'new lead', 'new leads')).toBe('1 new lead')
    expect(describeBadge(5, 'new lead', 'new leads')).toBe('5 new leads')
  })

  it('does not hide the real situation behind "99+"', () => {
    expect(describeBadge(99, 'review', 'reviews')).toBe('99 reviews')
    expect(describeBadge(240, 'review', 'reviews')).toBe('More than 99 reviews')
  })
})

describe('parseSidebarCounts — the response contract', () => {
  const valid = { clientAgentLeads: 5, leadFinder: 0, projects: 2, reviews: null, digitalMarketing: 1 }

  it('accepts exactly the documented shape, keeping null as "unknown"', () => {
    expect(parseSidebarCounts(valid)).toEqual(valid)
  })

  it('rejects a response that does not match, so a contract mismatch is an error and not wrong numbers', () => {
    expect(parseSidebarCounts(null)).toBeNull()
    expect(parseSidebarCounts([])).toBeNull()
    expect(parseSidebarCounts('5')).toBeNull()
    expect(parseSidebarCounts({ ...valid, projects: undefined })).toBeNull() // missing key
    expect(parseSidebarCounts({ ...valid, extra: 1 })).toBeNull() // unknown key
    expect(parseSidebarCounts({ ...valid, leadFinder: '3' })).toBeNull() // wrong type
    expect(parseSidebarCounts({ ...valid, leadFinder: -1 })).toBeNull()
    expect(parseSidebarCounts({ ...valid, leadFinder: 1.5 })).toBeNull()
  })
})
