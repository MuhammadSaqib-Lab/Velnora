import type { AIToolDefinition } from '../providers/types.js'

/**
 * The AI Consultant's only tool. Deliberately narrow and additive-only:
 * it can create exactly one QualifiedLead row and nothing else — no
 * update, no delete, no read access to existing data. This is the real
 * defense against "delete all leads"-style prompt injection: the model
 * has no tool capable of it, regardless of what the visitor asks for.
 *
 * `strict: true` (see AnthropicProvider) guarantees the model's input
 * validates against this schema; backend/src/validators/saveLeadTool.validator.ts
 * re-validates it anyway before it touches the database — model output
 * is external input, not a trusted internal value.
 */
export const saveLeadTool: AIToolDefinition = {
  name: 'save_lead',
  description:
    "Save a qualified visitor's project details to Velnora's CRM once they have voluntarily shared their contact info and what they need. Call this at most once per conversation, only with information the visitor actually provided, never a guessed or fabricated value.",
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The visitor's name." },
      email: { type: 'string', description: "The visitor's email address." },
      phone: { type: 'string', description: 'Phone number, if given.' },
      company: { type: 'string', description: 'Company or business name, if given.' },
      website: { type: 'string', description: 'Existing website URL, if given.' },
      service: {
        type: 'string',
        description: 'What they need, e.g. new website, redesign, SEO, AI solution, automation, other.',
      },
      requirements: {
        type: 'string',
        description: 'A concise summary of the project and what they need.',
      },
      budget: { type: 'string', description: 'Budget range, if discussed.' },
      timeline: { type: 'string', description: 'Desired timeline, if discussed.' },
      intent: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        description: 'Your internal read of purchase intent based on the conversation so far.',
      },
    },
    required: ['name', 'email', 'requirements', 'intent'],
    additionalProperties: false,
  },
}
