import type { OpportunityFinding, OpportunityKey } from '../opportunities/detectOpportunities.js'

export type LeadPriority = 'EXCELLENT' | 'STRONG' | 'POTENTIAL' | 'LOW'

export interface ScoreResult {
  score: number
  priority: LeadPriority
  reasons: string[]
}

/**
 * A deterministic points system, not an AI judgment call — the same
 * inputs always produce the same score, and every point is traceable to
 * a `reasons` line. This is what "make the scoring explainable" means in
 * practice: an AI-generated score would be neither reproducible nor
 * truly explainable, however plausible its stated reasoning looked.
 */
const OPPORTUNITY_POINTS: Record<OpportunityKey, number> = {
  NO_WEBSITE: 30,
  OLD_WEBSITE: 15,
  POOR_MOBILE: 15,
  WEAK_SEO: 15,
  AI_AUTOMATION: 10,
}

export function scoreLead(params: {
  hasEmail: boolean
  hasPhone: boolean
  opportunities: OpportunityFinding[]
}): ScoreResult {
  const reasons: string[] = []
  let score = 0

  if (params.hasEmail) {
    score += 15
    reasons.push('Verified public email found (+15)')
  }
  if (params.hasPhone) {
    score += 5
    reasons.push('Verified public phone found (+5)')
  }

  for (const finding of params.opportunities) {
    const points = OPPORTUNITY_POINTS[finding.type]
    score += points
    reasons.push(`${finding.type} opportunity identified (+${points})`)
  }

  const totalEvidenceLines = params.opportunities.reduce((sum, f) => sum + f.evidence.length, 0)
  if (totalEvidenceLines >= 3) {
    score += 10
    reasons.push('Multiple concrete evidence points collected (+10)')
  } else if (totalEvidenceLines >= 1) {
    score += 5
    reasons.push('At least one concrete evidence point collected (+5)')
  }

  score = Math.min(100, score)

  const priority: LeadPriority = score >= 90 ? 'EXCELLENT' : score >= 75 ? 'STRONG' : score >= 60 ? 'POTENTIAL' : 'LOW'

  return { score, priority, reasons }
}
