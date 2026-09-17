import type { WebsiteAnalysis } from '../analysis/websiteAnalyzer.js'

/**
 * Deterministic, code-based opportunity detection — never delegated to
 * the AI model. Every flag here traces back to a specific observed fact
 * in `WebsiteAnalysis`, and every opportunity carries its own evidence
 * list, so the result is fully explainable and reproducible (the same
 * input always produces the same output, unlike an AI judgment call).
 * The AI model is only ever used downstream for turning this structured,
 * already-verified output into email prose (see
 * backend/src/leadFinder/email/generateEmail.ts) — deciding what's true
 * and writing about what's true are deliberately separate steps.
 */

export type OpportunityKey = 'NO_WEBSITE' | 'OLD_WEBSITE' | 'POOR_MOBILE' | 'WEAK_SEO' | 'AI_AUTOMATION'

export interface OpportunityFinding {
  type: OpportunityKey
  evidence: string[]
  source: string
}

const APPOINTMENT_DRIVEN_CATEGORIES = [
  'dentist',
  'doctor',
  'clinic',
  'physiotherap',
  'salon',
  'spa',
  'gym',
  'fitness',
  'restaurant',
  'hotel',
  'law',
  'attorney',
  'real estate',
  'veterinar',
]

export function detectOpportunities(params: {
  hasWebsite: boolean
  website?: string
  category?: string
  analysis: WebsiteAnalysis | null
}): OpportunityFinding[] {
  const findings: OpportunityFinding[] = []
  const { hasWebsite, category, analysis } = params

  if (!hasWebsite) {
    findings.push({
      type: 'NO_WEBSITE',
      evidence: ['No official website was found in the available research.'],
      source: 'Business discovery source (no website field on the listing)',
    })
    // Nothing else to evaluate without a site, but AI/automation can
    // still be a genuine opportunity — handled below regardless of
    // whether a website exists.
  } else if (!analysis?.fetched) {
    findings.push({
      type: 'OLD_WEBSITE',
      evidence: [analysis?.fetchError ?? 'The website could not be reached during automated research.'],
      source: 'Automated website fetch attempt',
    })
  } else {
    const oldWebsiteEvidence: string[] = []
    if (!analysis.hasViewportMeta) oldWebsiteEvidence.push('No responsive viewport meta tag found in the page source.')
    if (!analysis.title) oldWebsiteEvidence.push('No <title> tag content found.')
    if (!analysis.hasContactCta) oldWebsiteEvidence.push('No clear contact call-to-action (phone link, email link, form, or booking text) found.')
    if (oldWebsiteEvidence.length > 0) {
      findings.push({ type: 'OLD_WEBSITE', evidence: oldWebsiteEvidence, source: 'Official business website' })
    }

    if (!analysis.hasViewportMeta) {
      findings.push({
        type: 'POOR_MOBILE',
        evidence: ['No responsive viewport meta tag found — the page is unlikely to adapt correctly to mobile screens.'],
        source: 'Official business website',
      })
    }

    const seoEvidence: string[] = []
    if (!analysis.metaDescription) seoEvidence.push('Missing meta description.')
    if (!analysis.h1Count) seoEvidence.push('No <h1> heading found.')
    else if (analysis.h1Count > 1) seoEvidence.push(`${analysis.h1Count} <h1> tags found (multiple top-level headings can weaken heading structure).`)
    if (typeof analysis.imgTotal === 'number' && analysis.imgTotal > 0) {
      const altRatio = (analysis.imgWithAlt ?? 0) / analysis.imgTotal
      if (altRatio < 0.5) {
        seoEvidence.push(`Only ${analysis.imgWithAlt ?? 0} of ${analysis.imgTotal} images have alt text.`)
      }
    }
    if (!analysis.hasCanonical) seoEvidence.push('No canonical link tag found.')
    if (!analysis.hasStructuredData) seoEvidence.push('No structured data (JSON-LD) found.')
    if (!analysis.robotsTxtFound) seoEvidence.push('No robots.txt found at the site root.')
    if (!analysis.sitemapFound) seoEvidence.push('No sitemap.xml found at the site root.')
    if (seoEvidence.length > 0) {
      findings.push({ type: 'WEAK_SEO', evidence: seoEvidence, source: 'Official business website' })
    }
  }

  const categoryIsAppointmentDriven = Boolean(
    category && APPOINTMENT_DRIVEN_CATEGORIES.some((marker) => category.toLowerCase().includes(marker)),
  )
  if (categoryIsAppointmentDriven && !analysis?.hasChatOrBookingWidget) {
    findings.push({
      type: 'AI_AUTOMATION',
      evidence: [
        hasWebsite
          ? 'No visible chat, FAQ, or booking assistant widget was detected on the website.'
          : 'No website (and therefore no automated booking/inquiry handling) was found.',
        `${category ?? 'This type of'} businesses commonly handle appointment/inquiry volume manually without one.`,
      ],
      source: hasWebsite ? 'Official business website' : 'Business discovery source',
    })
  }

  return findings
}
