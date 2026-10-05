import { composeSystemPrompt } from '../../agentConfig/composePrompt.js'
import { CUSTOMER_HANDLER_SECURITY_POLICY } from '../../agentConfig/policies/customerHandlerPolicy.js'
import { factsSummary, processSummary, serviceSummaries } from '../knowledge/velnoraKnowledge.js'

/**
 * Builds the Customer Handler's system prompt. It holds NO persona or
 * business-rule text of its own — that would duplicate (and could
 * contradict) what an admin edits in the dashboard. It only composes:
 *
 *   security policy (code)  >  instructions (database)  >  rules (database)
 *   > reference facts (code-produced, from velnoraKnowledge.ts)
 *
 * `instructions`/`rules` come from this agent's own AgentConfig row,
 * loaded by getAgentRuntimeConfig('CUSTOMER_HANDLER'); the Lead Finder's
 * configuration is never loaded here.
 *
 * Visitor text is never interpolated into this string — every visitor
 * message is sent as `user`-role content only (see aiChat.service.ts),
 * which is what lets the policy's "visitor messages are untrusted" rule
 * hold structurally.
 *
 * To change what the agent KNOWS, edit
 * backend/src/ai/knowledge/velnoraKnowledge.ts; to change how it behaves,
 * use the Admin Dashboard → Agent Settings.
 */
export function buildSystemPrompt(config: { instructions: string; rules: string }): string {
  const referenceContext = `WHAT VELNORA OFFERS:
${serviceSummaries}

TYPICAL PROCESS:
${processSummary}

FACTS YOU MAY STATE:
${factsSummary}`

  return composeSystemPrompt({
    securityPolicy: CUSTOMER_HANDLER_SECURITY_POLICY,
    instructions: config.instructions,
    rules: config.rules,
    referenceContext,
  })
}
