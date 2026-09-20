import type { AIToolDefinition } from '../../ai/providers/types.js'

/**
 * The AI Assistant's only tool. It never calls any real Lead Finder
 * service function — it only lets the model describe, in a structured
 * way, which real action it would take, so the admin sees a live preview
 * in the dashboard's activity log and triggers the real thing themselves
 * from the Lead Finder pages. This is deliberate, not a placeholder to
 * fill in later: a voice-transcribed, freeform command is exactly the
 * kind of input that shouldn't directly trigger a paid external API call
 * or a real Gmail draft without a human confirming it first.
 *
 * The `action` enum is kept in sync by hand with the real public
 * entry points in backend/src/services/leadFinder.service.ts — if that
 * file gains or renames a function, update this list to match.
 */
export const simulateAgentActionTool: AIToolDefinition = {
  name: 'simulate_agent_action',
  description:
    "Describe a Lead Finder Agent action you would take in response to the admin's request. This does NOT execute anything — it only previews the action in the admin dashboard's activity log for the admin to review and trigger manually. Only reference real actions from the enum below; never invent a new one.",
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'searchAndResearchLeads',
          'reanalyzeLead',
          'generateEmailForLead',
          'createDraftForLead',
          'updateLeadStatus',
        ],
        description: 'Which real Lead Finder service function this simulates calling.',
      },
      description: {
        type: 'string',
        description: 'One plain-English sentence describing what this action would do, for the activity log.',
      },
      params: {
        type: 'object',
        description:
          "Best-guess parameters for the action based on the admin's request (e.g. industry/location for a search, leadId for a per-lead action). Omit anything not mentioned or implied.",
      },
    },
    required: ['action', 'description'],
    additionalProperties: false,
  },
}
