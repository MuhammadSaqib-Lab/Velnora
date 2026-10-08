import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import {
  CANNOT_DETERMINE_MESSAGE,
  describeCriteria,
  mergeFilters,
  planSearch,
  type ExplicitFilters,
  type LeadSearchCriteria,
} from '../leadFinder/nlSearch/criteria.js'
import { parseLeadRequest } from '../leadFinder/nlSearch/parseLeadRequest.js'
import { detectSendIntent } from '../leadFinder/nlSearch/ruleParser.js'
import { assertAgentEnabled } from './agentConfig.service.js'
import { runLeadSearch, type LeadSearchStats } from './leadFinder.service.js'

/**
 * Natural-language front door to the EXISTING Lead Finder pipeline.
 *
 *   text → parse (AI, rule fallback) → validated criteria → merge explicit
 *   filters → plan (limits, feasibility, same schema as the manual API)
 *   → runLeadSearch() — the one real pipeline: find → verify → research →
 *   analyze → score → save → results.
 *
 * What it deliberately does NOT do: it never generates an email or creates
 * a Gmail draft on its own (those stay explicit per-lead admin actions,
 * exactly as before), and nothing in the request text can change that —
 * the criteria schema has no field that could express it, and there is no
 * send capability anywhere in the codebase to reach.
 */

export const NO_MATCHES_MESSAGE = 'Search completed, but no matching businesses were found.'
export const SEARCH_UNAVAILABLE_MESSAGE = 'Lead search is temporarily unavailable. Please try again.'
export const NO_AUTO_SEND_NOTE =
  'Nothing is sent automatically. The Lead Finder only finds and researches businesses; you generate and review each outreach email, and create a Gmail draft, from the lead’s page.'

export interface NlSearchInput {
  naturalLanguageQuery: string
  filters?: ExplicitFilters
}

interface LeadLike {
  opportunityScore: number | null
  opportunityTypes: string[]
  createdAt: Date
}

export type NlSearchOutcome =
  | { status: 'needs_clarification'; message: string; understood?: { summary: string; criteria: LeadSearchCriteria } }
  | {
      status: 'completed'
      message: string
      understood: { summary: string; criteria: LeadSearchCriteria; method: 'AI' | 'RULES' }
      warnings: string[]
      effectiveLimit: number
      stats: LeadSearchStats
      leads: unknown[]
    }

/** Ranks results the way the request asked (score by default), without dropping any. */
function orderLeads<T extends LeadLike>(leads: T[], criteria: LeadSearchCriteria): T[] {
  const sorted = [...leads].sort((a, b) =>
    criteria.sortBy === 'NEWEST'
      ? b.createdAt.getTime() - a.createdAt.getTime()
      : (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1),
  )
  const focus = criteria.prioritizeOpportunity
  if (!focus) return sorted
  // Stable: leads with the prioritized opportunity first, original order kept within each group.
  return [...sorted.filter((l) => l.opportunityTypes.includes(focus)), ...sorted.filter((l) => !l.opportunityTypes.includes(focus))]
}

/**
 * Best-effort history. A failure to record a search must never fail (or
 * change the outcome of) the search itself, and what is stored is only the
 * request text, the validated criteria, counts and a short status code —
 * never provider output, errors or secrets.
 */
async function recordStart(query: string, createdBy: string): Promise<string | null> {
  try {
    const row = await prisma.leadSearchRequest.create({ data: { query, status: 'RUNNING', createdBy } })
    return row.id
  } catch (error) {
    logger.error('leadSearch.history_create_failed', error)
    return null
  }
}

async function recordUpdate(id: string | null, data: Record<string, unknown>): Promise<void> {
  if (!id) return
  try {
    await prisma.leadSearchRequest.update({ where: { id }, data })
  } catch (error) {
    logger.error('leadSearch.history_update_failed', error)
  }
}

export async function runNaturalLanguageLeadSearch(input: NlSearchInput, createdBy: string): Promise<NlSearchOutcome> {
  // Same kill switch as every other Lead Finder action, checked BEFORE any
  // AI call so a disabled agent costs nothing.
  await assertAgentEnabled('LEAD_FINDER')

  const query = input.naturalLanguageQuery
  const historyId = await recordStart(query, createdBy)

  // 1–2. Natural language → validated criteria.
  const parsed = await parseLeadRequest(query)
  if (!parsed) {
    await recordUpdate(historyId, { status: 'NEEDS_CLARIFICATION', errorCode: 'UNPARSEABLE' })
    return { status: 'needs_clarification', message: CANNOT_DETERMINE_MESSAGE }
  }

  // 3. Combine with the explicit filter controls (they can only narrow/add).
  const criteria = mergeFilters(parsed.criteria, input.filters)
  const summary = describeCriteria(criteria)

  // 4. Plan: clarify instead of guessing, clamp to server limits, re-validate.
  const plan = planSearch(criteria)
  if (!plan.ok) {
    await recordUpdate(historyId, {
      status: 'NEEDS_CLARIFICATION',
      parsedCriteria: criteria,
      parseMethod: parsed.method,
      errorCode: 'NEEDS_CLARIFICATION',
    })
    return { status: 'needs_clarification', message: plan.message, understood: { summary, criteria } }
  }

  // 5. Run the existing Lead Finder pipeline.
  let result
  try {
    result = await runLeadSearch(plan.params)
  } catch (error) {
    const status = error instanceof AppError ? error.statusCode : 500
    await recordUpdate(historyId, {
      status: 'FAILED',
      parsedCriteria: criteria,
      parseMethod: parsed.method,
      errorCode: `HTTP_${status}`,
    })
    // A provider failure (502) gets the product's friendly message; other
    // known errors (e.g. "not configured", agent disabled) are already clear
    // and safe, and anything unexpected falls through to the generic handler.
    if (error instanceof AppError && error.statusCode === 502) {
      throw new AppError(502, SEARCH_UNAVAILABLE_MESSAGE, undefined, { cause: error })
    }
    throw error
  }

  const leads = orderLeads(result.leads as unknown as LeadLike[], criteria) as unknown[]
  const warnings = [...plan.warnings]
  if (detectSendIntent(query)) warnings.push(NO_AUTO_SEND_NOTE)

  await recordUpdate(historyId, {
    status: 'COMPLETED',
    parsedCriteria: criteria,
    parseMethod: parsed.method,
    foundCount: result.stats.found,
    resultCount: result.stats.matched,
  })

  return {
    status: 'completed',
    message: leads.length === 0 ? NO_MATCHES_MESSAGE : `Found ${leads.length} matching lead${leads.length === 1 ? '' : 's'}.`,
    understood: { summary, criteria, method: parsed.method },
    warnings,
    effectiveLimit: plan.effectiveLimit,
    stats: result.stats,
    leads,
  }
}
