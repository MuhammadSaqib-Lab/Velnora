import { describe, expect, it, vi } from 'vitest'
import { detectOpportunities } from '../src/leadFinder/opportunities/detectOpportunities.js'
import { scoreLead } from '../src/leadFinder/scoring/scoreLead.js'
import { extractDomain, findExistingLead, normalizeName } from '../src/leadFinder/dedupe.js'
import type { WebsiteAnalysis } from '../src/leadFinder/analysis/websiteAnalyzer.js'

const GOOD_ANALYSIS: WebsiteAnalysis = {
  fetched: true,
  statusCode: 200,
  title: 'Acme Dental — Cosmetic & Family Dentistry',
  metaDescription: 'Family dentistry in Lahore.',
  hasViewportMeta: true,
  hasCanonical: true,
  hasStructuredData: true,
  h1Count: 1,
  h2Count: 4,
  imgTotal: 10,
  imgWithAlt: 10,
  scriptCount: 3,
  htmlByteSize: 50_000,
  hasContactCta: true,
  hasChatOrBookingWidget: true,
  robotsTxtFound: true,
  sitemapFound: true,
}

describe('detectOpportunities: no website', () => {
  it('flags NO_WEBSITE with honest, non-absolute wording', () => {
    const findings = detectOpportunities({ hasWebsite: false, category: 'Dentist', analysis: null })
    const noWebsite = findings.find((f) => f.type === 'NO_WEBSITE')
    expect(noWebsite).toBeDefined()
    expect(noWebsite?.evidence[0]).toMatch(/no official website was found/i)
    expect(noWebsite?.evidence[0]).not.toMatch(/definitely|guaranteed|certainly/i)
  })
})

describe('detectOpportunities: a genuinely good website', () => {
  it('produces no OLD_WEBSITE, POOR_MOBILE, or WEAK_SEO findings', () => {
    const findings = detectOpportunities({ hasWebsite: true, category: 'Dentist', analysis: GOOD_ANALYSIS })
    expect(findings.find((f) => f.type === 'OLD_WEBSITE')).toBeUndefined()
    expect(findings.find((f) => f.type === 'POOR_MOBILE')).toBeUndefined()
    expect(findings.find((f) => f.type === 'WEAK_SEO')).toBeUndefined()
  })

  it('does not flag AI_AUTOMATION when a booking widget is already present', () => {
    const findings = detectOpportunities({ hasWebsite: true, category: 'Dentist', analysis: GOOD_ANALYSIS })
    expect(findings.find((f) => f.type === 'AI_AUTOMATION')).toBeUndefined()
  })
})

describe('detectOpportunities: an old/unreachable website', () => {
  it('flags OLD_WEBSITE with the honest fetch-failure reason when the site cannot be reached', () => {
    const findings = detectOpportunities({
      hasWebsite: true,
      category: 'Law Firm',
      analysis: { fetched: false, fetchError: 'The website did not respond during automated research.' },
    })
    const old = findings.find((f) => f.type === 'OLD_WEBSITE')
    expect(old?.evidence).toEqual(['The website did not respond during automated research.'])
  })

  it('flags OLD_WEBSITE from missing title/viewport/CTA on a reachable but dated site', () => {
    const analysis: WebsiteAnalysis = { ...GOOD_ANALYSIS, hasViewportMeta: false, title: undefined, hasContactCta: false }
    const findings = detectOpportunities({ hasWebsite: true, category: 'Restaurant', analysis })
    const old = findings.find((f) => f.type === 'OLD_WEBSITE')
    expect(old?.evidence.length).toBeGreaterThanOrEqual(3)
  })
})

describe('detectOpportunities: poor mobile', () => {
  it('flags POOR_MOBILE only on a missing viewport meta tag, never invented', () => {
    const analysis: WebsiteAnalysis = { ...GOOD_ANALYSIS, hasViewportMeta: false }
    const findings = detectOpportunities({ hasWebsite: true, category: 'Gym', analysis })
    const mobile = findings.find((f) => f.type === 'POOR_MOBILE')
    expect(mobile).toBeDefined()
    expect(mobile?.evidence[0]).toMatch(/viewport/i)
  })
})

describe('detectOpportunities: weak SEO', () => {
  it('flags WEAK_SEO with one evidence line per missing signal', () => {
    const analysis: WebsiteAnalysis = {
      ...GOOD_ANALYSIS,
      metaDescription: undefined,
      h1Count: 0,
      hasCanonical: false,
      hasStructuredData: false,
      robotsTxtFound: false,
      sitemapFound: false,
      imgTotal: 10,
      imgWithAlt: 1,
    }
    const findings = detectOpportunities({ hasWebsite: true, category: 'Salon', analysis })
    const seo = findings.find((f) => f.type === 'WEAK_SEO')
    expect(seo?.evidence).toEqual(
      expect.arrayContaining([
        'Missing meta description.',
        'No <h1> heading found.',
        expect.stringContaining('1 of 10 images'),
        'No canonical link tag found.',
        'No structured data (JSON-LD) found.',
        'No robots.txt found at the site root.',
        'No sitemap.xml found at the site root.',
      ]),
    )
  })
})

describe('detectOpportunities: AI automation', () => {
  it('flags AI_AUTOMATION for an appointment-driven category with no chat/booking widget', () => {
    const analysis: WebsiteAnalysis = { ...GOOD_ANALYSIS, hasChatOrBookingWidget: false }
    const findings = detectOpportunities({ hasWebsite: true, category: 'Physiotherapy Clinic', analysis })
    expect(findings.find((f) => f.type === 'AI_AUTOMATION')).toBeDefined()
  })

  it('never claims certainty — evidence is phrased as "potential"', () => {
    const analysis: WebsiteAnalysis = { ...GOOD_ANALYSIS, hasChatOrBookingWidget: false }
    const findings = detectOpportunities({ hasWebsite: true, category: 'Restaurant', analysis })
    const ai = findings.find((f) => f.type === 'AI_AUTOMATION')
    expect(ai?.evidence.join(' ')).not.toMatch(/definitely needs|guaranteed/i)
  })

  it('does not flag AI_AUTOMATION for a non-appointment-driven category', () => {
    const analysis: WebsiteAnalysis = { ...GOOD_ANALYSIS, hasChatOrBookingWidget: false }
    const findings = detectOpportunities({ hasWebsite: true, category: 'Software Company', analysis })
    expect(findings.find((f) => f.type === 'AI_AUTOMATION')).toBeUndefined()
  })
})

describe('detectOpportunities: multiple opportunities', () => {
  it('can flag NO_WEBSITE and AI_AUTOMATION together for a website-less appointment business', () => {
    const findings = detectOpportunities({ hasWebsite: false, category: 'Dentist', analysis: null })
    const types = findings.map((f) => f.type)
    expect(types).toContain('NO_WEBSITE')
    expect(types).toContain('AI_AUTOMATION')
  })

  it('can flag OLD_WEBSITE, POOR_MOBILE, WEAK_SEO, and AI_AUTOMATION simultaneously', () => {
    const badAnalysis: WebsiteAnalysis = {
      fetched: true,
      statusCode: 200,
      hasViewportMeta: false,
      hasCanonical: false,
      hasStructuredData: false,
      h1Count: 0,
      imgTotal: 0,
      hasContactCta: false,
      hasChatOrBookingWidget: false,
      robotsTxtFound: false,
      sitemapFound: false,
    }
    const findings = detectOpportunities({ hasWebsite: true, category: 'Dentist', analysis: badAnalysis })
    const types = new Set(findings.map((f) => f.type))
    expect(types).toEqual(new Set(['OLD_WEBSITE', 'POOR_MOBILE', 'WEAK_SEO', 'AI_AUTOMATION']))
  })
})

describe('scoreLead', () => {
  it('scores contactability, opportunities, and evidence quality explainably', () => {
    const result = scoreLead({
      hasEmail: true,
      hasPhone: true,
      opportunities: [
        { type: 'NO_WEBSITE', evidence: ['a'], source: 's' },
        { type: 'AI_AUTOMATION', evidence: ['b', 'c'], source: 's' },
      ],
    })
    // 15 (email) + 5 (phone) + 30 (NO_WEBSITE) + 10 (AI_AUTOMATION) + 10 (>=3 evidence lines) = 70
    expect(result.score).toBe(70)
    expect(result.priority).toBe('POTENTIAL') // 60-74 band
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(result.reasons.join(' ')).toMatch(/NO_WEBSITE opportunity identified \(\+30\)/)
  })

  it('caps the score at 100', () => {
    const result = scoreLead({
      hasEmail: true,
      hasPhone: true,
      opportunities: [
        { type: 'NO_WEBSITE', evidence: ['a', 'b', 'c'], source: 's' },
        { type: 'OLD_WEBSITE', evidence: [], source: 's' },
        { type: 'POOR_MOBILE', evidence: [], source: 's' },
        { type: 'WEAK_SEO', evidence: [], source: 's' },
        { type: 'AI_AUTOMATION', evidence: [], source: 's' },
      ],
    })
    expect(result.score).toBe(100)
    expect(result.priority).toBe('EXCELLENT')
  })

  it('assigns LOW priority when there is little to work with', () => {
    const result = scoreLead({ hasEmail: false, hasPhone: false, opportunities: [] })
    expect(result.score).toBe(0)
    expect(result.priority).toBe('LOW')
  })
})

describe('dedupe', () => {
  it('normalizes business names for tolerant comparison', () => {
    expect(normalizeName('Corrigan & Voss LLC')).toBe(normalizeName('corrigan and voss llc'.replace('and', '&')))
    expect(normalizeName('  Acme   Dental! ')).toBe('acme dental')
  })

  it('extracts a lowercased, www-stripped domain', () => {
    expect(extractDomain('https://WWW.Example.com/path')).toBe('example.com')
    expect(extractDomain(undefined)).toBeUndefined()
    expect(extractDomain('not a url')).toBeUndefined()
  })

  it('matches an existing lead by domain first', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'lead_1', email: null, phone: null, website: null })
    const prisma = { lead: { findUnique, findFirst: vi.fn(), findMany: vi.fn() } }
    const result = await findExistingLead(prisma as never, { businessName: 'Acme', domain: 'acme.com' })
    expect(result?.id).toBe('lead_1')
    expect(findUnique).toHaveBeenCalledWith({ where: { domain: 'acme.com' }, select: expect.any(Object) })
  })

  it('falls back to normalized name matching when no domain/phone hit', async () => {
    const prisma = {
      lead: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 'lead_2', businessName: 'Acme Dental!!', email: null, phone: null, website: null }]),
      },
    }
    const result = await findExistingLead(prisma as never, { businessName: 'ACME dental' })
    expect(result?.id).toBe('lead_2')
  })

  it('returns null when nothing matches (a genuinely new business)', async () => {
    const prisma = {
      lead: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    }
    const result = await findExistingLead(prisma as never, { businessName: 'Brand New Co' })
    expect(result).toBeNull()
  })
})
