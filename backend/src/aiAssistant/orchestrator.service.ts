import { z } from 'zod'
import { AnthropicProvider } from '../ai/providers/AnthropicProvider.js'
import type { AIContentBlock, AIMessage } from '../ai/providers/types.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { buildAssistantSystemPrompt } from './systemPrompt.js'
import { simulateAgentActionTool } from './tools/simulateAgentAction.tool.js'

const provider = new AnthropicProvider()

/** Bounds cost/context per request — mirrors aiChat.service.ts's MAX_HISTORY_MESSAGES. */
const MAX_HISTORY_MESSAGES = 20

export interface SimulatedAction {
  action:
    | 'searchAndResearchLeads'
    | 'reanalyzeLead'
    | 'generateEmailForLead'
    | 'createDraftForLead'
    | 'updateLeadStatus'
  description: string
  params?: Record<string, unknown>
}

export interface AssistantResult {
  reply: string
  actions: SimulatedAction[]
}

/**
 * Re-validates the model's tool input before it's trusted for anything
 * (including just displaying it) — model output is external input, same
 * rule as saveLeadTool.validator.ts, even though this tool has no
 * database or side effect at all.
 */
const simulatedActionSchema = z.object({
  action: z.enum([
    'searchAndResearchLeads',
    'reanalyzeLead',
    'generateEmailForLead',
    'createDraftForLead',
    'updateLeadStatus',
  ]),
  description: z.string().trim().min(1).max(300),
  params: z.record(z.string(), z.unknown()).optional(),
})

const PROVIDER_UNAVAILABLE_MESSAGE = "I'm having trouble connecting to the AI provider right now."

export async function handleAssistantCommand(
  history: AIMessage[],
  userText: string,
): Promise<AssistantResult> {
  const boundedHistory = history.slice(-MAX_HISTORY_MESSAGES)
  const messages: AIMessage[] = [...boundedHistory, { role: 'user', content: userText }]
  const system = buildAssistantSystemPrompt()

  let result
  try {
    result = await provider.generateResponse({
      system,
      messages,
      tools: [simulateAgentActionTool],
    })
  } catch (error) {
    throw new AppError(502, PROVIDER_UNAVAILABLE_MESSAGE, undefined, { cause: error })
  }

  const toolUses = result.content.filter(
    (block): block is Extract<AIContentBlock, { type: 'tool_use' }> => block.type === 'tool_use',
  )

  let finalContent = result.content
  const actions: SimulatedAction[] = []

  if (toolUses.length > 0) {
    const toolResults: AIContentBlock[] = []

    for (const toolUse of toolUses) {
      const parsed = simulatedActionSchema.safeParse(toolUse.input)
      if (parsed.success) {
        actions.push(parsed.data)
        toolResults.push({
          type: 'tool_result',
          toolUseId: toolUse.id,
          content: JSON.stringify({ simulated: true, ...parsed.data }),
        })
      } else {
        logger.warn('ai_assistant.invalid_tool_input', { tool: toolUse.name })
        toolResults.push({
          type: 'tool_result',
          toolUseId: toolUse.id,
          content: 'Invalid action parameters — describe the action to the admin in plain text instead.',
          isError: true,
        })
      }
    }

    try {
      const followUp = await provider.generateResponse({
        system,
        messages: [
          ...messages,
          { role: 'assistant', content: result.content },
          { role: 'user', content: toolResults },
        ],
      })
      finalContent = followUp.content
    } catch (error) {
      logger.error('ai_assistant.followup_error', error)
      finalContent = [{ type: 'text', text: 'Noted — see the simulated action below.' }]
    }
  }

  const replyText = extractText(finalContent) || 'Done.'
  return { reply: replyText, actions }
}

function extractText(content: AIContentBlock[]): string {
  return content
    .filter((block): block is Extract<AIContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}
