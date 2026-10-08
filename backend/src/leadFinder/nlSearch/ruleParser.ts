import {
  cleanPhrase,
  normalizeBusinessType,
  normalizeCriteria,
  type LeadSearchCriteria,
  OPPORTUNITY_TYPES,
} from './criteria.js'

type OpportunityType = (typeof OPPORTUNITY_TYPES)[number]

/**
 * Deterministic natural-language → criteria parser. It is the FALLBACK for
 * when the AI parser is unavailable or returns something unusable (no API
 * key, provider outage, malformed output) — so the search box keeps
 * working — and it is what makes the parsing rules unit-testable without a
 * model. It is intentionally modest: clear "find N <type> in <place> with
 * <condition>" requests, plus the opportunity phrases listed in the
 * product spec. Unusual phrasing is the AI parser's job.
 *
 * Like every parser here it can only emit the allowlisted criteria shape
 * (via normalizeCriteria) — it has no way to express an action.
 */

// ───────────────────────────── opportunity lexicon ───────────────────────────

const WEBSITE = String.raw`(?:web\s?sites?|web\s?pages?|sites?|web presence|online presence)`

const LEXICON: Array<[OpportunityType, RegExp[]]> = [
  [
    'NO_WEBSITE',
    [
      new RegExp(String.raw`\b(?:no|without|lack(?:s|ing)?|missing)\s+(?:an?\s+|any\s+)?(?:official\s+|proper\s+)?${WEBSITE}`, 'i'),
      new RegExp(String.raw`\b(?:don'?t|do not|doesn'?t|does not|haven'?t|have not|hasn'?t|has not)\s+(?:even\s+)?(?:have|got)\s+(?:an?\s+|any\s+)?(?:official\s+|proper\s+)?${WEBSITE}`, 'i'),
      new RegExp(String.raw`\b${WEBSITE}\s+(?:doesn'?t|does not|don'?t|do not|isn'?t|is not)\s+(?:exist|existing|available)`, 'i'),
      /\bnot\s+(?:have\s+)?(?:a\s+)?web\s?sites?\b/i,
    ],
  ],
  [
    'OLD_WEBSITE',
    [
      new RegExp(String.raw`\b(?:old|outdated|out[- ]of[- ]date|dated|ancient|obsolete|legacy|ageing|aging)\s+(?:looking\s+)?${WEBSITE}`, 'i'),
      new RegExp(String.raw`\b${WEBSITE}\s+(?:is|are|look(?:s)?|that (?:is|are))\s+(?:very\s+)?(?:old|outdated|out[- ]of[- ]date|dated)`, 'i'),
    ],
  ],
  [
    'POOR_MOBILE',
    [
      /\b(?:poor|bad|terrible|awful|weak|broken|horrible|lousy)\s+mobile\b/i,
      /\bnot\s+(?:mobile[- ]friendly|responsive|optimi[sz]ed for (?:mobile|phones?))\b/i,
      /\bmobile[- ]unfriendly\b/i,
      new RegExp(String.raw`\b${WEBSITE}\s+(?:doesn'?t|does not|don'?t|do not|won'?t|will not|isn'?t|is not)\s+(?:work|display|load|look|function)\s+(?:well\s+|properly\s+)?on\s+(?:phones?|mobiles?|smartphones?)`, 'i'),
    ],
  ],
  [
    'WEAK_SEO',
    [
      /\b(?:weak|poor|bad|low|terrible|lousy)\s+(?:seo|search\s+(?:engine\s+)?(?:ranking|rankings|visibility)|google\s+(?:visibility|ranking|rankings)|online\s+visibility)\b/i,
      /\bnot\s+(?:ranking|visible|showing up)\s+(?:well\s+)?(?:on|in)\s+google\b/i,
      /\bneeds?\s+(?:better\s+)?seo\b/i,
    ],
  ],
  [
    'AI_AUTOMATION',
    [
      /\b(?:ai|artificial intelligence)\b/i,
      /\b(?:automation|automate|automating|chatbots?)\b/i,
    ],
  ],
]

function matchTypes(text: string): OpportunityType[] {
  const found: OpportunityType[] = []
  for (const [type, patterns] of LEXICON) {
    if (patterns.some((p) => p.test(text))) found.push(type)
  }
  // "…website opportunities" = anything website-related.
  if (/\bwebsite\s+opportunit/i.test(text)) {
    for (const t of ['NO_WEBSITE', 'OLD_WEBSITE', 'POOR_MOBILE', 'WEAK_SEO'] as const) if (!found.includes(t)) found.push(t)
  }
  return found
}

// ───────────────────────────── small extractors ──────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  five: 5, ten: 10, fifteen: 15, twenty: 20, 'twenty five': 25, 'twenty-five': 25, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100,
}

function extractLimit(typePart: string): number | null {
  const digits = /\b(\d{1,4})\b/.exec(typePart)
  if (digits) {
    const n = Number(digits[1])
    return n >= 1 ? n : null
  }
  const word = new RegExp(String.raw`\b(${Object.keys(NUMBER_WORDS).join('|')})\b`, 'i').exec(typePart)
  return word ? (NUMBER_WORDS[word[1]!.toLowerCase()] ?? null) : null
}

/** Words that may begin a clause after the place name ("…in Lahore with…", "…, verify their…"). */
const CLAUSE_START = String.raw`(?:with|that|which|who|whose|where|having|without|and|but|for|including|ranked|sorted|rank|sort|prioriti[sz]e|verify|show|then|so|please|list|give|find)`
const LOCATION_PREPOSITION = /\b(?:in|near|around|at|within|across|from)\s+(?:the\s+)?(?:city\s+of\s+|area\s+of\s+|town\s+of\s+)?/gi
const NOT_A_PLACE = /^(?:need|order|terms|general|particular|addition|fact|case|poor|bad|good|great|some|any|all|the|a|an|their|its|his|her|our|my|your|one|two|three|top|best|google|search|mobile|seo|ranking|visibility|demand|particular)\b/i

function titleCase(value: string): string {
  return value.replace(/\b([a-z])([a-z']*)/g, (_m, first: string, rest: string) => `${first.toUpperCase()}${rest}`)
}

interface ParsedLocation {
  area: string | null
  city: string | null
  country: string | null
  /** Index in the text where the location preposition begins — the type/count part is everything before it. */
  prepositionIndex: number
}

function extractLocation(text: string): ParsedLocation | null {
  LOCATION_PREPOSITION.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LOCATION_PREPOSITION.exec(text)) !== null) {
    const rest = text.slice(match.index + match[0].length)
    if (NOT_A_PLACE.test(rest)) continue

    // Up to the first clause word or sentence end; commas stay (for "Blue Area, Islamabad").
    const stop = new RegExp(String.raw`\s+${CLAUSE_START}\b|[.;:!?]|$`, 'i').exec(rest)
    const raw = rest.slice(0, stop?.index ?? rest.length)

    const segments: string[] = []
    for (const piece of raw.split(',')) {
      const trimmed = piece.trim()
      if (!trimmed) continue
      if (new RegExp(String.raw`^${CLAUSE_START}\b`, 'i').test(trimmed)) break
      segments.push(trimmed)
      if (segments.length === 3) break
    }

    const cleaned = segments.map((s) => cleanPhrase(s)).filter((s): s is string => s !== null)
    if (cleaned.length === 0 || cleaned.length !== segments.length) continue
    const pretty = cleaned.map((s) => (s === s.toLowerCase() ? titleCase(s) : s))

    if (pretty.length === 1) return { area: null, city: pretty[0]!, country: null, prepositionIndex: match.index }
    if (pretty.length === 2) return { area: pretty[0]!, city: pretty[1]!, country: null, prepositionIndex: match.index }
    return { area: pretty[0]!, city: pretty[1]!, country: pretty[2]!, prepositionIndex: match.index }
  }
  return null
}

function extractBusinessType(typePart: string): string | null {
  // A business type is only read from an actual search request. Without a
  // recognised search verb up front there is nothing to anchor it to, and
  // arbitrary text (including an instruction like "ignore previous
  // instructions") must not be promoted into a search term.
  const verb = /^\s*(?:please\s+)?(?:can you\s+)?(?:find|get|give|show|list|search(?:\s+for)?|look(?:\s+for)?|locate|discover|identify)\s+(?:me\s+)?/i.exec(typePart)
  if (!verb) return null
  let phrase = typePart.slice(verb[0].length)
  // Stop at the first clause word if there is no location preposition ("Find restaurants with no website").
  const stop = new RegExp(String.raw`\s+${CLAUSE_START}\b|[.;:!?,]`, 'i').exec(phrase)
  if (stop) phrase = phrase.slice(0, stop.index)

  phrase = phrase
    .replace(/^(?:the\s+)?(?:(?:best|top|good|great|some|all)\s+)*/i, '')
    .replace(/^\d{1,4}\s+/, '')
    .replace(new RegExp(String.raw`^(?:${Object.keys(NUMBER_WORDS).join('|')})\s+`, 'i'), '')
    .replace(/\b(?:website\s+)?(?:opportunit(?:y|ies)|leads?|prospects?)\b/gi, '')
    .trim()
  return normalizeBusinessType(phrase)
}

/**
 * True only when the administrator wants businesses that HAVE an email
 * ("…with an email address"). "…and email them all" is a request to
 * contact leads — never a filter, and never an action (see
 * detectSendIntent) — so those phrases are removed first.
 */
function wantsEmailOnLead(text: string): boolean {
  const withoutSending = text.replace(
    /\b(?:automatically\s+)?(?:e-?mail|mail|message|contact|reach out to)(?:ing)?\s+(?:them|all|each|everyone|every one|the leads|those|these)\b/gi,
    ' ',
  )
  return /\b(?:with|has|have|having|and|who have|that have|which have)\s+(?:an?\s+|valid\s+|verified\s+|public\s+|working\s+)*e-?mails?\b/i.test(withoutSending)
}

/**
 * Detects wording that asks for outreach to be SENT. It never changes
 * what the search does (the Lead Finder only ever drafts) — it only lets
 * the UI say so out loud instead of leaving the administrator to assume.
 */
export function detectSendIntent(text: string): boolean {
  return (
    /\bautomatic(?:ally)?\b/i.test(text) ||
    /\b(?:send|sending|email|e-mail|mail|message|contact|reach out to|outreach)\b[^.]*\b(?:them|all|every|each|everyone|those|these|the leads)\b/i.test(text)
  )
}

function splitRankClause(text: string): { main: string; rank: string } {
  const idx = text.search(/\b(?:and\s+)?(?:prioriti[sz]e|rank|sort|order them)\b/i)
  return idx === -1 ? { main: text, rank: '' } : { main: text.slice(0, idx), rank: text.slice(idx) }
}

// ───────────────────────────────── entry point ───────────────────────────────

export function parseWithRules(input: string): LeadSearchCriteria | null {
  const text = input.replace(/\s+/g, ' ').trim()
  if (!text) return null

  const { main, rank } = splitRankClause(text)
  const location = extractLocation(main)
  const typePart = location ? main.slice(0, location.prepositionIndex) : main

  const opportunityTypes = matchTypes(main)
  const prioritize = /prioriti[sz]e/i.test(rank) ? (matchTypes(rank)[0] ?? null) : null

  const websiteRequired =
    !opportunityTypes.includes('NO_WEBSITE') &&
    /\b(?:with|that have|who have|having|which have)\s+(?:an?\s+|existing\s+|working\s+)*websites?\b/i.test(main)

  const minPriority = /\bexcellent\b/i.test(text)
    ? 'EXCELLENT'
    : /\b(?:high|strong)[- ]priority\b|\bstrong\s+leads?\b/i.test(text)
      ? 'STRONG'
      : null

  return normalizeCriteria({
    location: { area: location?.area ?? null, city: location?.city ?? null, country: location?.country ?? null },
    businessType: extractBusinessType(typePart),
    limit: extractLimit(typePart),
    opportunityTypes,
    requirements: { emailRequired: wantsEmailOnLead(main), websiteRequired },
    minPriority,
    sortBy: /\b(?:newest|latest|most recent)\b/i.test(text) ? 'NEWEST' : 'OPPORTUNITY_SCORE',
    prioritizeOpportunity: prioritize,
  })
}
