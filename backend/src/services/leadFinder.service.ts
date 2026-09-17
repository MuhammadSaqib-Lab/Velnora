import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { GooglePlacesProvider } from '../leadFinder/providers/GooglePlacesProvider.js'
import type { BusinessCandidate } from '../leadFinder/providers/types.js'
import { analyzeWebsite, type WebsiteAnalysis } from '../leadFinder/analysis/websiteAnalyzer.js'
import { detectOpportunities, type OpportunityFinding, type OpportunityKey } from '../leadFinder/opportunities/detectOpportunities.js'
import { scoreLead, type LeadPriority } from '../leadFinder/scoring/scoreLead.js'
import { extractDomain, findExistingLead } from '../leadFinder/dedupe.js'
import { mapWithConcurrency } from '../leadFinder/concurrency.js'
import { generateOutreachEmail, EmailGenerationError } from '../leadFinder/email/generateEmail.js'
import { createDraft, isGmailReadyToDraft } from '../leadFinder/gmail/GmailProvider.js'

const searchProvider = new GooglePlacesProvider()
const RESEARCH_CONCURRENCY = 5

const NO_PROVIDER_CONFIGURED_MESSAGE =
  'Business search is not configured yet. Set GOOGLE_PLACES_API_KEY to enable Lead Finder searches.'
const NO_AI_CONFIGURED_MESSAGE =
  'Email generation is not configured yet. Set ANTHROPIC_API_KEY to enable this.'
const NO_GMAIL_CONFIGURED_MESSAGE =
  'Gmail is not configured yet. Complete the one-time OAuth setup (see backend/README.md) to enable this.'

export interface SearchLeadsParams {
  industry: string
  location: string
  count: number
  opportunityTypes?: OpportunityKey[]
  minScore?: number
}

interface ResearchedCandidate {
  candidate: BusinessCandidate
  analysis: WebsiteAnalysis | null
  opportunities: OpportunityFinding[]
  score: number
  priority: LeadPriority
}

async function researchCandidate(candidate: BusinessCandidate): Promise<ResearchedCandidate> {
  const hasWebsite = Boolean(candidate.website)
  const analysis = hasWebsite ? await analyzeWebsite(candidate.website as string) : null

  const opportunities = detectOpportunities({
    hasWebsite,
    website: candidate.website,
    category: candidate.category,
    analysis,
  })

  const { score, priority } = scoreLead({
    hasEmail: Boolean(analysis?.contactEmail),
    hasPhone: Boolean(candidate.phone),
    opportunities,
  })

  return { candidate, analysis, opportunities, score, priority }
}

function evidenceRecord(opportunities: OpportunityFinding[]) {
  const record: Partial<Record<OpportunityKey, { evidence: string[]; source: string }>> = {}
  for (const finding of opportunities) {
    record[finding.type] = { evidence: finding.evidence, source: finding.source }
  }
  return record
}

/**
 * `WebsiteAnalysis`/evidence records are plain, JSON-serializable data —
 * this cast exists only because TypeScript can't structurally match a
 * named interface against Prisma's generic `InputJsonValue` (which wants
 * an index signature), not because the value itself is anything other
 * than the JSON it looks like.
 */
function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export async function searchAndResearchLeads(params: SearchLeadsParams) {
  const configured = await searchProvider.healthCheck()
  if (!configured) {
    throw new AppError(503, NO_PROVIDER_CONFIGURED_MESSAGE)
  }

  let candidates: BusinessCandidate[]
  try {
    candidates = await searchProvider.findBusinesses({
      industry: params.industry,
      location: params.location,
      limit: params.count,
    })
  } catch (error) {
    throw new AppError(
      502,
      'Business search failed. Please try again shortly.',
      undefined,
      { cause: error },
    )
  }

  const researched = await mapWithConcurrency(candidates, RESEARCH_CONCURRENCY, researchCandidate)

  const filtered = researched.filter((r) => {
    if (r.opportunities.length === 0) return false
    if (params.minScore !== undefined && r.score < params.minScore) return false
    if (params.opportunityTypes && params.opportunityTypes.length > 0) {
      const found = new Set(r.opportunities.map((o) => o.type))
      if (!params.opportunityTypes.some((t) => found.has(t))) return false
    }
    return true
  })

  const savedLeads = []
  for (const result of filtered) {
    savedLeads.push(await persistResearchedLead(result))
  }

  return savedLeads
}

async function persistResearchedLead(result: ResearchedCandidate) {
  const { candidate, analysis, opportunities, score, priority } = result
  const domain = extractDomain(candidate.website)

  const researchFields = {
    opportunityTypes: opportunities.map((o) => o.type),
    opportunityScore: score,
    priority,
    status: 'RESEARCHED' as const,
    analysis: toJsonInput({ website: analysis, researchedAt: new Date().toISOString() }),
    evidence: toJsonInput(evidenceRecord(opportunities)),
  }

  try {
    const existing = await findExistingLead(prisma, {
      businessName: candidate.businessName,
      domain,
      phone: candidate.phone,
    })

    if (existing) {
      // Enrich, never overwrite: this pass's findings replace the
      // opportunity/score/analysis fields (always the latest research),
      // but contact info already on file only gets filled in where it
      // was previously missing, never blanked out by a thinner result.
      return await prisma.lead.update({
        where: { id: existing.id },
        data: {
          ...researchFields,
          email: existing.email ?? analysis?.contactEmail,
          phone: existing.phone ?? candidate.phone,
          website: existing.website ?? candidate.website,
        },
      })
    }

    return await prisma.lead.create({
      data: {
        ...researchFields,
        businessName: candidate.businessName,
        category: candidate.category,
        website: candidate.website,
        domain,
        email: analysis?.contactEmail,
        phone: candidate.phone,
        location: candidate.location,
        source: candidate.source,
        sourceUrl: candidate.sourceUrl,
      },
    })
  } catch (error) {
    logger.error('leadFinder.persist_error', error, { businessName: candidate.businessName })
    throw new AppError(500, 'A database error occurred while saving research results.', undefined, { cause: error })
  }
}

export async function reanalyzeLead(id: string) {
  const lead = await getLeadOrThrow(id)

  const hasWebsite = Boolean(lead.website)
  const analysis = hasWebsite ? await analyzeWebsite(lead.website as string) : null
  const opportunities = detectOpportunities({
    hasWebsite,
    website: lead.website ?? undefined,
    category: lead.category ?? undefined,
    analysis,
  })
  // Enrich, never overwrite: a freshly-found email fills a gap, it
  // never replaces an email already on file (which may have been
  // manually corrected by the human reviewing this lead).
  const email = lead.email ?? analysis?.contactEmail
  const { score, priority } = scoreLead({
    hasEmail: Boolean(email),
    hasPhone: Boolean(lead.phone),
    opportunities,
  })

  try {
    return await prisma.lead.update({
      where: { id },
      data: {
        email,
        opportunityTypes: opportunities.map((o) => o.type),
        opportunityScore: score,
        priority,
        analysis: toJsonInput({ website: analysis, researchedAt: new Date().toISOString() }),
        evidence: toJsonInput(evidenceRecord(opportunities)),
      },
    })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while updating this lead.', undefined, { cause: error })
  }
}

export interface ListLeadsParams {
  status?: string
  minScore?: number
  maxScore?: number
  category?: string
  location?: string
  search?: string
  priority?: string
  opportunityTypes?: OpportunityKey[]
  source?: string
  hasEmail?: boolean
  hasWebsite?: boolean
  sort?: 'score_desc' | 'newest' | 'oldest' | 'priority' | 'updated_desc'
  page: number
  pageSize: number
}

const LEAD_SORT_ORDER: Record<NonNullable<ListLeadsParams['sort']>, Prisma.LeadOrderByWithRelationInput> = {
  score_desc: { opportunityScore: 'desc' },
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  updated_desc: { updatedAt: 'desc' },
  // Prisma can't order by an enum's "logical" rank directly; EXCELLENT
  // happens to sort first alphabetically-descending too, but score_desc
  // is the more meaningful tiebreaker within a priority band.
  priority: { priority: 'desc' },
}

export async function listLeads(params: ListLeadsParams) {
  const where: Prisma.LeadWhereInput = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.priority ? { priority: params.priority as never } : {}),
    ...(params.minScore !== undefined || params.maxScore !== undefined
      ? { opportunityScore: { gte: params.minScore, lte: params.maxScore } }
      : {}),
    ...(params.category ? { category: { contains: params.category, mode: 'insensitive' as const } } : {}),
    ...(params.location ? { location: { contains: params.location, mode: 'insensitive' as const } } : {}),
    ...(params.source ? { source: { contains: params.source, mode: 'insensitive' as const } } : {}),
    ...(params.opportunityTypes && params.opportunityTypes.length > 0
      ? { opportunityTypes: { hasSome: params.opportunityTypes as never[] } }
      : {}),
    ...(params.hasEmail !== undefined ? { email: params.hasEmail ? { not: null } : null } : {}),
    ...(params.hasWebsite !== undefined ? { website: params.hasWebsite ? { not: null } : null } : {}),
    ...(params.search
      ? {
          OR: [
            { businessName: { contains: params.search, mode: 'insensitive' as const } },
            { domain: { contains: params.search, mode: 'insensitive' as const } },
            { email: { contains: params.search, mode: 'insensitive' as const } },
            { location: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  let leads, total
  try {
    ;[leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: LEAD_SORT_ORDER[params.sort ?? 'score_desc'],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.lead.count({ where }),
    ])
  } catch (error) {
    throw new AppError(500, 'A database error occurred while listing leads.', undefined, { cause: error })
  }

  return { leads, total, page: params.page, pageSize: params.pageSize }
}

async function getLeadOrThrow(id: string) {
  let lead
  try {
    lead = await prisma.lead.findUnique({ where: { id } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while looking up this lead.', undefined, { cause: error })
  }
  if (!lead) throw new AppError(404, 'Lead not found.')
  return lead
}

export async function getLead(id: string) {
  return getLeadOrThrow(id)
}

/**
 * Reconstructs the opportunities/score breakdown from fields already
 * stored on the row (opportunityTypes, evidence, email, phone) and
 * re-runs the same deterministic `scoreLead()` used at research time —
 * no new schema field needed, since the function is pure and its inputs
 * are already persisted. Used by the admin dashboard's lead detail view.
 */
export async function getLeadWithScoreBreakdown(id: string) {
  const lead = await getLeadOrThrow(id)

  const evidence = (lead.evidence ?? {}) as Partial<Record<OpportunityKey, { evidence: string[]; source: string }>>
  const opportunities: OpportunityFinding[] = lead.opportunityTypes.map((type) => ({
    type,
    evidence: evidence[type]?.evidence ?? [],
    source: evidence[type]?.source ?? 'Research findings',
  }))

  const { reasons } = scoreLead({
    hasEmail: Boolean(lead.email),
    hasPhone: Boolean(lead.phone),
    opportunities,
  })

  return { ...lead, scoreBreakdown: { score: lead.opportunityScore, priority: lead.priority, reasons } }
}

export async function generateEmailForLead(id: string) {
  const lead = await getLeadOrThrow(id)

  if (!lead.email) {
    throw new AppError(400, 'This lead has no verified contact email (NO_CONTACT_EMAIL) — an email cannot be generated or guessed.')
  }

  const evidence = (lead.evidence ?? {}) as Partial<Record<OpportunityKey, { evidence: string[]; source: string }>>
  const opportunities: OpportunityFinding[] = lead.opportunityTypes.map((type) => ({
    type,
    evidence: evidence[type]?.evidence ?? [],
    source: evidence[type]?.source ?? 'Research findings',
  }))

  const analysis = (lead.analysis as { website?: WebsiteAnalysis } | null)?.website

  let generated
  try {
    generated = await generateOutreachEmail({
      businessName: lead.businessName,
      category: lead.category ?? undefined,
      location: lead.location ?? undefined,
      website: lead.website ?? undefined,
      hasWebsite: Boolean(lead.website),
      opportunities,
      title: analysis?.title,
      metaDescription: analysis?.metaDescription,
    })
  } catch (error) {
    if (error instanceof EmailGenerationError) {
      throw new AppError(502, NO_AI_CONFIGURED_MESSAGE, undefined, { cause: error })
    }
    throw error
  }

  try {
    return await prisma.lead.update({
      where: { id },
      data: { emailSubject: generated.subject, emailBody: generated.body },
    })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while saving the generated email.', undefined, { cause: error })
  }
}

export async function createDraftForLead(id: string, force = false) {
  const lead = await getLeadOrThrow(id)

  if (!lead.email) {
    throw new AppError(400, 'This lead has no verified contact email (NO_CONTACT_EMAIL) — a draft cannot be created.')
  }
  if (!lead.emailSubject || !lead.emailBody) {
    throw new AppError(400, 'Generate an email for this lead before creating a Gmail draft.')
  }
  if (lead.gmailDraftId && !force) {
    throw new AppError(
      409,
      `A Gmail draft already exists for this lead (id: ${lead.gmailDraftId}). Pass { "force": true } to create another instead of reusing it.`,
    )
  }
  if (!isGmailReadyToDraft()) {
    throw new AppError(503, NO_GMAIL_CONFIGURED_MESSAGE)
  }

  let draftId: string
  try {
    draftId = await createDraft({ to: lead.email, subject: lead.emailSubject, body: lead.emailBody })
  } catch (error) {
    logger.error('leadFinder.gmail_draft_error', error, { leadId: id })
    throw new AppError(502, 'Creating the Gmail draft failed. No draft was created.', undefined, { cause: error })
  }

  try {
    return await prisma.lead.update({
      where: { id },
      data: { gmailDraftId: draftId, status: 'EMAIL_DRAFTED' },
    })
  } catch (error) {
    // The draft WAS created successfully in Gmail at this point — log
    // loudly so the id isn't lost, but don't claim the draft failed.
    logger.error('leadFinder.gmail_draft_id_save_failed', error, { leadId: id, draftId })
    throw new AppError(
      500,
      `The Gmail draft was created (id: ${draftId}) but saving that to the database failed. Check Gmail drafts directly.`,
      undefined,
      { cause: error },
    )
  }
}

/**
 * `status` is one of the enum values validateBody + leadStatusUpdateSchema
 * already restricted to (QUALIFIED/CONTACTED/REPLIED/NOT_INTERESTED/
 * CONVERTED/DISQUALIFIED) — that Zod schema is the single source of
 * truth for which statuses a human can set here, not duplicated in this
 * service layer.
 */
export async function updateLeadStatus(id: string, status: string) {
  await getLeadOrThrow(id)
  try {
    return await prisma.lead.update({ where: { id }, data: { status: status as never } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while updating this lead.', undefined, { cause: error })
  }
}
