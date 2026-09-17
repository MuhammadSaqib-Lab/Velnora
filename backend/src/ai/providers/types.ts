/**
 * Provider-agnostic shapes for the AI Client Handling Agent. Business
 * logic (backend/src/services/aiChat.service.ts) only ever imports from
 * this file, never a provider SDK directly — swapping AnthropicProvider
 * for a different provider later means writing one new class here, not
 * touching the conversation/qualification/persistence logic.
 */

export type AIRole = 'user' | 'assistant'

export type AIContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean }

export interface AIMessage {
  role: AIRole
  content: string | AIContentBlock[]
}

export interface AIToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface AIGenerateResult {
  content: AIContentBlock[]
  stopReason: string | null
}

export type AIEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface AIProvider {
  generateResponse(params: {
    system: string
    messages: AIMessage[]
    tools?: AIToolDefinition[]
    /** Per-call overrides — omit to use the provider's configured
     * defaults (AI_EFFORT/AI_MAX_TOKENS). Used by callers with different
     * cost/quality tradeoffs than the chat agent, e.g. the Lead Finder's
     * email generation (LEAD_EMAIL_AI_EFFORT), without changing the
     * chat agent's own behavior. */
    effort?: AIEffort
    maxTokens?: number
  }): Promise<AIGenerateResult>

  /** Cheap, no-network-call check of whether this provider is usable. */
  healthCheck(): Promise<boolean>
}
