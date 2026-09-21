/**
 * Canonical assistant states, decoupled from any specific rendering
 * technology. The face (or any future avatar) reacts to these; nothing
 * in the AI orchestration, voice, or chat logic ever reaches into
 * Three.js objects directly — see expressionController.ts for the
 * adapter that translates state into visual parameters.
 */
export type AssistantState =
  | 'idle'
  | 'listening'
  | 'attentive'
  | 'thinking'
  | 'speaking'
  | 'working'
  | 'success'
  | 'concerned'
  | 'positive'
  | 'caution'

/**
 * A single agent as it actually exists in this codebase today — see
 * backend/README.md's "AI Client Handling Agent" and "AI Lead Finder
 * Agent" sections. Only two autonomous agents exist; `capabilities`
 * lists what each one actually does internally (e.g. the Lead Finder's
 * website analysis / SEO opportunity detection / scoring / drafting
 * pipeline), not separate live agents with their own status — there is
 * no backend entity to honestly report status for beyond these two.
 */
export interface AgentDefinition {
  id: string
  name: string
  description: string
  capabilities: string[]
  requiresConfirmation: boolean
}

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    id: 'lead-finder',
    name: 'Lead Finder Agent',
    description: 'Discovers businesses that may need Velnora, researches them, and drafts outreach.',
    capabilities: [
      'Business discovery (Google Places)',
      'Website analysis',
      'SEO & opportunity detection',
      'Lead scoring',
      'Outreach email drafting',
      'Gmail draft creation',
    ],
    requiresConfirmation: true,
  },
  {
    id: 'client-handling',
    name: 'Customer Handling Agent',
    description: "Talks with site visitors in real time and qualifies leads from the public chat widget.",
    capabilities: ['Visitor Q&A', 'Lead qualification', 'Lead capture'],
    requiresConfirmation: false,
  },
]
