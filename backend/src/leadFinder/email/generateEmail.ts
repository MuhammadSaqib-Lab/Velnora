import { env } from '../../config/env.js'
import { AnthropicProvider } from '../../ai/providers/AnthropicProvider.js'
import type { OpportunityFinding } from '../opportunities/detectOpportunities.js'
import { buildEmailSystemPrompt } from './systemPrompt.js'

const provider = new AnthropicProvider()

export interface GeneratedEmail {
  subject: string
  body: string
}

export class EmailGenerationError extends Error {}

/**
 * Builds the research JSON handed to the model. Deliberately only
 * includes structured, already-verified facts (opportunity
 * types/evidence produced by detectOpportunities.ts, both code-generated
 * strings) plus a couple of short sanitized snippets — never raw HTML or
 * full page text. See systemPrompt.ts's header comment for why this
 * matters for prompt-injection resistance.
 */
function buildResearchPayload(params: {
  businessName: string
  category?: string
  location?: string
  website?: string
  hasWebsite: boolean
  opportunities: OpportunityFinding[]
  title?: string
  metaDescription?: string
}) {
  return {
    businessName: params.businessName,
    category: params.category ?? 'unknown',
    location: params.location ?? 'unknown',
    hasWebsite: params.hasWebsite,
    website: params.website,
    websiteTitle: params.title,
    websiteMetaDescription: params.metaDescription,
    opportunities: params.opportunities.map((finding) => ({
      type: finding.type,
      evidence: finding.evidence,
      source: finding.source,
    })),
  }
}

export async function generateOutreachEmail(params: {
  businessName: string
  category?: string
  location?: string
  website?: string
  hasWebsite: boolean
  opportunities: OpportunityFinding[]
  title?: string
  metaDescription?: string
}): Promise<GeneratedEmail> {
  const payload = buildResearchPayload(params)

  let result
  try {
    result = await provider.generateResponse({
      system: buildEmailSystemPrompt(),
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      effort: env.LEAD_EMAIL_AI_EFFORT,
      maxTokens: 800,
    })
  } catch (error) {
    throw new EmailGenerationError(
      error instanceof Error ? error.message : 'Email generation provider call failed',
    )
  }

  const text = result.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  const parsed = parseEmailOutput(text)
  if (!parsed) {
    throw new EmailGenerationError('The AI provider returned a response that could not be parsed into a subject and body.')
  }
  return parsed
}

function parseEmailOutput(text: string): GeneratedEmail | null {
  const match = /SUBJECT:\s*(.+?)\s*\n+BODY:\s*\n([\s\S]+)/i.exec(text)
  if (!match) return null

  const subject = match[1]?.trim()
  const body = match[2]?.trim()
  if (!subject || !body) return null

  return { subject, body }
}
