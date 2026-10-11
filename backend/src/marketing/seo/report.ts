/**
 * Report rendering and comparison. Pure functions over stored findings.
 */
export interface StoredFinding {
  checkKey: string
  category: string
  label: 'VERIFIED' | 'RECOMMENDATION' | 'ESTIMATE' | 'UNAVAILABLE'
  result: string | null
  title: string
  detail: string
  pageUrl: string | null
  impact: number | null
  effort: number | null
  confidence: string | null
}

export interface StoredAudit {
  id: string
  url: string
  finalUrl: string | null
  domain: string
  kind: string
  createdAt: Date
  summary: unknown
}

const LABEL_TITLES: Record<StoredFinding['label'], string> = {
  VERIFIED: 'Verified findings',
  RECOMMENDATION: 'Recommendations (prioritized)',
  ESTIMATE: 'Estimated opportunities',
  UNAVAILABLE: 'Unavailable data',
}

const LABEL_HELP: Record<StoredFinding['label'], string> = {
  VERIFIED: 'Directly observed by this audit.',
  RECOMMENDATION: 'Advice derived from the verified findings. Impact and effort are 1–5; confidence is how sure we are the fix is worthwhile.',
  ESTIMATE: 'A qualitative read of opportunity. No traffic or ranking numbers are implied.',
  UNAVAILABLE: 'Cannot be known without a data source that is not connected. Nothing is guessed.',
}

/** Higher = fix first: big impact, small effort, high confidence. */
export function priorityScore(f: Pick<StoredFinding, 'impact' | 'effort' | 'confidence'>): number {
  const confidence = f.confidence === 'HIGH' ? 1 : f.confidence === 'MEDIUM' ? 0.7 : 0.4
  return ((f.impact ?? 1) / Math.max(f.effort ?? 3, 1)) * confidence
}

export function sortFindings<T extends StoredFinding>(findings: T[]): T[] {
  const order = { VERIFIED: 0, RECOMMENDATION: 1, ESTIMATE: 2, UNAVAILABLE: 3 } as const
  const resultOrder: Record<string, number> = { FAIL: 0, WARN: 1, INFO: 2, PASS: 3 }
  return [...findings].sort((a, b) => {
    if (order[a.label] !== order[b.label]) return order[a.label] - order[b.label]
    if (a.label === 'RECOMMENDATION') return priorityScore(b) - priorityScore(a)
    if (a.label === 'VERIFIED') return (resultOrder[a.result ?? 'INFO'] ?? 2) - (resultOrder[b.result ?? 'INFO'] ?? 2)
    return a.category.localeCompare(b.category)
  })
}

export function buildMarkdownReport(audit: StoredAudit, findings: StoredFinding[]): string {
  const lines: string[] = []
  lines.push(`# SEO audit — ${audit.domain}`, '')
  lines.push(`- **Address audited:** ${audit.url}`)
  if (audit.finalUrl && audit.finalUrl !== audit.url) lines.push(`- **Final address:** ${audit.finalUrl}`)
  lines.push(`- **Type:** ${audit.kind.toLowerCase()}`, `- **Date:** ${audit.createdAt.toISOString()}`, '')
  lines.push('> Findings are labelled so you always know what is a fact and what is not. Search rankings, traffic, keyword volumes and backlinks are never estimated without a connected data source.', '')

  for (const label of ['VERIFIED', 'RECOMMENDATION', 'ESTIMATE', 'UNAVAILABLE'] as const) {
    const group = sortFindings(findings.filter((f) => f.label === label))
    if (group.length === 0) continue
    lines.push(`## ${LABEL_TITLES[label]}`, '', `_${LABEL_HELP[label]}_`, '')
    for (const f of group) {
      const tag = f.label === 'VERIFIED' && f.result ? `[${f.result}] ` : ''
      const meta =
        f.label === 'RECOMMENDATION' ? ` _(impact ${f.impact ?? '?'}/5 · effort ${f.effort ?? '?'}/5 · confidence ${f.confidence ?? '?'})_` : ''
      lines.push(`- **${tag}${f.title}**${meta} — ${f.detail}${f.pageUrl ? ` (${f.pageUrl})` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

// ───────────────────────────────── comparison ────────────────────────────────

export interface ComparisonRow {
  checkKey: string
  category: string
  title: string
  base: string | null
  other: string | null
  change: 'IMPROVED' | 'REGRESSED' | 'SAME' | 'ONLY_BASE' | 'ONLY_OTHER'
}

const RESULT_RANK: Record<string, number> = { PASS: 3, INFO: 2, WARN: 1, FAIL: 0 }

/** Compares the VERIFIED results of two audits check by check (same site over time, or us vs. a competitor). */
export function compareFindings(base: StoredFinding[], other: StoredFinding[]): ComparisonRow[] {
  const verified = (list: StoredFinding[]) => new Map(list.filter((f) => f.label === 'VERIFIED' && f.result).map((f) => [f.checkKey, f]))
  const a = verified(base)
  const b = verified(other)
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort()

  return keys.map((checkKey): ComparisonRow => {
    const fa = a.get(checkKey)
    const fb = b.get(checkKey)
    const ref = (fa ?? fb)!
    let change: ComparisonRow['change']
    if (fa && !fb) change = 'ONLY_BASE'
    else if (!fa && fb) change = 'ONLY_OTHER'
    else {
      const ra = RESULT_RANK[fa!.result!] ?? 2
      const rb = RESULT_RANK[fb!.result!] ?? 2
      change = rb > ra ? 'IMPROVED' : rb < ra ? 'REGRESSED' : 'SAME'
    }
    return { checkKey, category: ref.category, title: ref.title, base: fa?.result ?? null, other: fb?.result ?? null, change }
  })
}
