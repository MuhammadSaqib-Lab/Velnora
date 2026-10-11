import { env } from '../config/env.js'
import { AnthropicProvider } from '../ai/providers/AnthropicProvider.js'
import type { AIToolDefinition } from '../ai/providers/types.js'
import { composeSystemPrompt } from '../agentConfig/composePrompt.js'
import { DIGITAL_MARKETING_SECURITY_POLICY } from '../agentConfig/policies/digitalMarketingPolicy.js'
import { getAgentRuntimeConfig } from '../services/agentConfig.service.js'
import { services } from '../services/content.service.js'
import { logger } from '../utils/logger.js'
import { AI_NOT_CONFIGURED, MarketingTaskError } from './errors.js'

const provider = new AnthropicProvider()

/**
 * Builds the Digital Marketing agent's system prompt:
 *   locked security policy (code)  >  instructions (database)  >  rules
 *   (database)  >  reference facts (Velnora's real service list, code)
 * It loads ONLY this agent's own configuration row — never the Customer
 * Handler's or the Lead Finder's — and holds no editable business text of its
 * own (that lives in AgentConfig, edited under Digital Marketing → Rules &
 * Instructions). Task data and any external content travel only in the
 * `user` message, never here.
 */
export function buildMarketingSystemPrompt(config: { instructions: string; rules: string }): string {
  const referenceContext = `VELNORA SERVICES (real, current list — do not describe services beyond these):\n${services
    .map((s) => `- ${s.title}: ${s.description}`)
    .join('\n')}`
  return composeSystemPrompt({
    securityPolicy: DIGITAL_MARKETING_SECURITY_POLICY,
    instructions: config.instructions,
    rules: config.rules,
    referenceContext,
    outputContract:
      'OUTPUT FORMAT (required by the application)\nRespond by calling the provided tool exactly once with the complete result. Write no other text. The tool input is validated; anything outside its schema is discarded.',
  })
}

/**
 * One structured generation. The model's ONLY way to answer is the supplied
 * tool; its input is passed through `normalize` (strict, sanitizing) before
 * anything is stored. Provider failures become short, safe task errors.
 */
export async function generateStructured<T>(params: {
  tool: AIToolDefinition
  /** JSON of the task parameters — admin-supplied or code-produced, never raw website text. */
  userMessage: string
  normalize: (input: unknown) => T | null
}): Promise<T> {
  if (!(await provider.healthCheck())) throw AI_NOT_CONFIGURED

  // This agent's own configuration, loaded fresh for every task.
  const config = await getAgentRuntimeConfig('DIGITAL_MARKETING')

  let result
  try {
    result = await provider.generateResponse({
      system: buildMarketingSystemPrompt(config),
      messages: [{ role: 'user', content: params.userMessage }],
      tools: [params.tool],
      effort: env.MARKETING_AI_EFFORT,
      maxTokens: env.MARKETING_AI_MAX_TOKENS,
    })
  } catch (error) {
    logger.warn('marketing.ai_call_failed', { reason: error instanceof Error ? error.name : 'unknown' })
    throw new MarketingTaskError('AI_UNAVAILABLE', 'The AI provider is temporarily unavailable. Please retry in a moment.')
  }

  const toolUse = result.content.find(
    (block): block is Extract<(typeof result.content)[number], { type: 'tool_use' }> => block.type === 'tool_use' && block.name === params.tool.name,
  )
  const normalized = toolUse ? params.normalize(toolUse.input) : null
  if (normalized === null) {
    throw new MarketingTaskError('AI_INVALID_OUTPUT', 'The AI returned a result that could not be used. Please retry the task.')
  }
  return normalized
}
