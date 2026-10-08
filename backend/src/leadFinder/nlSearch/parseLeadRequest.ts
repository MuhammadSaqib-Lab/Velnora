import { parseWithAi } from './aiParser.js'
import { hasLocation, type LeadSearchCriteria } from './criteria.js'
import { parseWithRules } from './ruleParser.js'

export interface ParsedRequest {
  criteria: LeadSearchCriteria
  /** Which parser produced the criteria. */
  method: 'AI' | 'RULES'
}

function hasAnything(criteria: LeadSearchCriteria | null): criteria is LeadSearchCriteria {
  return criteria !== null && (hasLocation(criteria) || Boolean(criteria.businessType ?? criteria.industry))
}

/**
 * Natural language → validated criteria. One AI call (cheap, structured,
 * schema-checked); if the AI is unavailable or yields nothing usable the
 * deterministic rule parser takes over so the search box keeps working.
 * Returns null only when neither could extract anything.
 *
 * This function ONLY parses. It runs no search, touches no database, and
 * has no way to send anything — what happens next is decided by
 * planSearch() and the existing Lead Finder pipeline.
 */
export async function parseLeadRequest(text: string): Promise<ParsedRequest | null> {
  const ai = await parseWithAi(text)
  if (hasAnything(ai)) return { criteria: ai, method: 'AI' }

  const rules = parseWithRules(text)
  if (hasAnything(rules)) return { criteria: rules, method: 'RULES' }

  // Nothing usable from either; still return whatever the AI structured
  // (e.g. only an opportunity type) so the clarification can be specific.
  if (ai) return { criteria: ai, method: 'AI' }
  if (rules) return { criteria: rules, method: 'RULES' }
  return null
}
