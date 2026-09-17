import type { PrismaClient } from '@prisma/client'

/** Lowercased, alphanumeric-only comparison key — tolerant of "Corrigan &
 * Voss" vs "Corrigan and Voss" vs "CORRIGAN & VOSS LLC" style variance. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function extractDomain(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return undefined
  }
}

export interface ExistingLeadFields {
  id: string
  email: string | null
  phone: string | null
  website: string | null
}

const EXISTING_LEAD_SELECT = { id: true, email: true, phone: true, website: true } as const

/**
 * Finds an existing Lead matching the same real-world business, checked
 * in order of reliability: domain (exact, DB-unique) -> phone (exact) ->
 * normalized business name (fuzzy, checked in code since Postgres can't
 * index a normalized-on-read comparison cheaply at this scale). Returns
 * null only if none of these match anything on file. Returns enough
 * fields for the caller to *enrich* rather than blindly overwrite (a
 * re-research pass that finds less than before shouldn't erase
 * previously-found contact info).
 */
export async function findExistingLead(
  prisma: Pick<PrismaClient, 'lead'>,
  params: { businessName: string; domain?: string; phone?: string },
): Promise<ExistingLeadFields | null> {
  if (params.domain) {
    const byDomain = await prisma.lead.findUnique({ where: { domain: params.domain }, select: EXISTING_LEAD_SELECT })
    if (byDomain) return byDomain
  }

  if (params.phone) {
    const byPhone = await prisma.lead.findFirst({ where: { phone: params.phone }, select: EXISTING_LEAD_SELECT })
    if (byPhone) return byPhone
  }

  const target = normalizeName(params.businessName)
  const candidates = await prisma.lead.findMany({
    where: { businessName: { contains: params.businessName, mode: 'insensitive' } },
    select: { ...EXISTING_LEAD_SELECT, businessName: true },
    take: 10,
  })
  return candidates.find((candidate) => normalizeName(candidate.businessName) === target) ?? null
}
