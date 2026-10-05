/**
 * The explicit allowlist of agents whose editable behavior is stored in
 * the database (AgentConfig) and managed from the Admin Dashboard.
 *
 * The AI Assistant (src/aiAssistant/) is deliberately NOT in this list —
 * it is a separate, later phase and has no editable configuration here.
 *
 * Agent identity never comes from request input: every route in
 * adminAgentConfig.routes.ts is bound to exactly one of these keys at
 * registration time, so there is no `:agentId` parameter an attacker (or
 * a buggy client) could vary to read or write another agent's config.
 */
export const AGENT_KEYS = ['CUSTOMER_HANDLER', 'LEAD_FINDER'] as const

export type AgentKey = (typeof AGENT_KEYS)[number]

export interface AgentDescriptor {
  key: AgentKey
  /** URL segment under /api/admin/agents/. */
  slug: 'customer-handler' | 'lead-finder'
  displayName: string
}

export const AGENTS: readonly AgentDescriptor[] = [
  { key: 'CUSTOMER_HANDLER', slug: 'customer-handler', displayName: 'Customer Handler Agent' },
  { key: 'LEAD_FINDER', slug: 'lead-finder', displayName: 'Lead Finder Agent' },
]

export function describeAgent(key: AgentKey): AgentDescriptor {
  const agent = AGENTS.find((candidate) => candidate.key === key)
  if (!agent) throw new Error(`Unknown agent key: ${key}`)
  return agent
}
