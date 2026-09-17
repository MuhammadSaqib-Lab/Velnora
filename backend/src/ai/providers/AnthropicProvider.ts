import Anthropic from '@anthropic-ai/sdk'
import { env } from '../../config/env.js'
import type { AIContentBlock, AIEffort, AIGenerateResult, AIMessage, AIProvider, AIToolDefinition } from './types.js'

/**
 * The only file in this codebase that imports the Anthropic SDK directly.
 * Translates the provider-agnostic shapes in ./types.ts to and from the
 * Anthropic wire format, so a future second provider is a new class next
 * to this one, not a rewrite of aiChat.service.ts.
 *
 * The client is constructed lazily and only if ANTHROPIC_API_KEY is set —
 * see env.ts's comment on why that variable is optional at the app level.
 */
const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null

function toAnthropicBlock(block: AIContentBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text }
    case 'tool_use':
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      }
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: block.toolUseId,
        content: block.content,
        is_error: block.isError,
      }
  }
}

function toAnthropicMessages(messages: AIMessage[]): Anthropic.MessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === 'string' ? message.content : message.content.map(toAnthropicBlock),
  }))
}

function toAnthropicTools(tools: AIToolDefinition[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    strict: true,
  }))
}

function fromAnthropicContent(content: Anthropic.ContentBlock[]): AIContentBlock[] {
  const blocks: AIContentBlock[] = []
  for (const block of content) {
    if (block.type === 'text') {
      blocks.push({ type: 'text', text: block.text })
    } else if (block.type === 'tool_use') {
      blocks.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input })
    }
    // thinking/redacted_thinking/server_tool blocks are intentionally not
    // surfaced — the consultant persona only ever needs the final text
    // and any tool call.
  }
  return blocks
}

export class AnthropicProvider implements AIProvider {
  async generateResponse(params: {
    system: string
    messages: AIMessage[]
    tools?: AIToolDefinition[]
    effort?: AIEffort
    maxTokens?: number
  }): Promise<AIGenerateResult> {
    if (!client) {
      throw new Error('ANTHROPIC_API_KEY is not configured')
    }

    const response = await client.messages.create({
      model: env.AI_MODEL,
      max_tokens: params.maxTokens ?? env.AI_MAX_TOKENS,
      system: params.system,
      messages: toAnthropicMessages(params.messages),
      // Adaptive thinking is Claude Opus 5's default; effort defaults to
      // the chat agent's AI_EFFORT (low, right for a concise chat reply)
      // but callers with a different cost/quality tradeoff — e.g. the
      // Lead Finder's email generation — can pass their own.
      thinking: { type: 'adaptive' },
      output_config: { effort: params.effort ?? env.AI_EFFORT },
      ...(params.tools && params.tools.length > 0 ? { tools: toAnthropicTools(params.tools) } : {}),
    })

    return {
      content: fromAnthropicContent(response.content),
      stopReason: response.stop_reason,
    }
  }

  async healthCheck(): Promise<boolean> {
    // Deliberately not a live API call: this backs the public /api/health
    // endpoint, and a paid round-trip on every health check/uptime probe
    // would be an easy way to run up an AI bill for free. It only
    // confirms the provider is configured, not that the key is valid.
    return client !== null
  }
}
