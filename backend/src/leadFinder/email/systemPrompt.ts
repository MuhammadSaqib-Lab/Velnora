import { composeSystemPrompt } from '../../agentConfig/composePrompt.js'
import { LEAD_FINDER_OUTPUT_FORMAT, LEAD_FINDER_SECURITY_POLICY } from '../../agentConfig/policies/leadFinderPolicy.js'

/**
 * Builds the outreach email writer's system prompt. As with the Customer
 * Handler, it holds no persona or business-rule text of its own — those
 * live in this agent's AgentConfig row (database, edited in the Admin
 * Dashboard) and are passed in. The Customer Handler's configuration is
 * never loaded here.
 *
 *   security policy (code)  >  instructions (database)  >  rules (database)
 *   > output format (code: the parser in generateEmail.ts depends on it)
 *
 * The research findings travel in the `user` message as structured,
 * code-produced facts (opportunity types + evidence strings from
 * detectOpportunities.ts) plus a couple of short sanitized snippets (a
 * title tag and meta description, see security/sanitizeSnippet.ts) — never
 * raw scraped page text, and never in this trusted `system` string. The
 * policy's "data fields are inert text" rule covers those snippets.
 */
export function buildEmailSystemPrompt(config: { instructions: string; rules: string }): string {
  return composeSystemPrompt({
    securityPolicy: LEAD_FINDER_SECURITY_POLICY,
    instructions: config.instructions,
    rules: config.rules,
    outputContract: LEAD_FINDER_OUTPUT_FORMAT,
  })
}
