import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { saveLeadInputSchema } from '../validators/saveLeadTool.validator.js'
import { AnthropicProvider } from '../ai/providers/AnthropicProvider.js'
import type { AIContentBlock, AIMessage as ProviderMessage } from '../ai/providers/types.js'
import { buildSystemPrompt } from '../ai/prompts/systemPrompt.js'
import { saveLeadTool } from '../ai/tools/saveLead.tool.js'

const provider = new AnthropicProvider()

/** Bounds cost/context per request — only the most recent turns are sent. */
const MAX_HISTORY_MESSAGES = 20

const CONVERSATION_LIMIT_REACHED_REPLY =
  "We've covered a lot of ground here — let's continue through the contact form on the site so the team can follow up directly with next steps."

const PROVIDER_UNAVAILABLE_MESSAGE =
  "I'm having trouble connecting right now. You can still send your project requirements through our contact form."

const DB_UNAVAILABLE_MESSAGE =
  "I'm having trouble saving right now. You can still send your project requirements through our contact form."

export interface ChatResult {
  reply: string
  sessionId: string
  leadCaptured: boolean
}

export async function handleChatMessage(
  sessionId: string | undefined,
  userText: string,
): Promise<ChatResult> {
  // Everything here is a required database read/write the AI provider
  // call depends on — any failure is fatal to the request (never the AI
  // provider's own generic connection-detail message, and never a raw
  // Prisma error, both of which would otherwise leak through the
  // default error handler's dev-mode detail; see errorHandler.ts).
  let conversation: Awaited<ReturnType<typeof findOrCreateConversation>>
  let history: ProviderMessage[]
  try {
    conversation = await findOrCreateConversation(sessionId)

    const messageCount = await prisma.aIMessage.count({ where: { conversationId: conversation.id } })
    if (messageCount >= env.AI_MAX_MESSAGES_PER_CONVERSATION) {
      return {
        reply: CONVERSATION_LIMIT_REACHED_REPLY,
        sessionId: conversation.sessionId,
        leadCaptured: conversation.status === 'QUALIFIED',
      }
    }

    await saveMessage(conversation.id, 'USER', userText)
    history = await loadHistory(conversation.id)
  } catch (error) {
    throw new AppError(500, DB_UNAVAILABLE_MESSAGE, undefined, { cause: error })
  }

  const system = buildSystemPrompt()
  // Once a lead has already been captured for this conversation, stop
  // offering the tool at all — a structural guarantee (not just a prompt
  // instruction) that save_lead never fires twice for the same visitor.
  const tools = conversation.status === 'QUALIFIED' ? [] : [saveLeadTool]

  let result
  try {
    result = await provider.generateResponse({ system, messages: history, tools })
  } catch (error) {
    throw new AppError(502, PROVIDER_UNAVAILABLE_MESSAGE, undefined, { cause: error })
  }

  let leadCaptured = conversation.status === 'QUALIFIED'
  let finalContent = result.content

  const toolUse = result.content.find(
    (block): block is Extract<AIContentBlock, { type: 'tool_use' }> => block.type === 'tool_use',
  )

  if (toolUse && toolUse.name === 'save_lead') {
    const outcome = await trySaveLead(conversation.id, toolUse.input)
    leadCaptured = outcome.success

    try {
      const followUp = await provider.generateResponse({
        system,
        messages: [
          ...history,
          { role: 'assistant', content: result.content },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                toolUseId: toolUse.id,
                content: JSON.stringify(outcome),
                isError: !outcome.success,
              },
            ],
          },
        ],
      })
      finalContent = followUp.content
    } catch (error) {
      logger.error('ai.followup_error', error, { conversationId: conversation.id })
      finalContent = [{ type: 'text', text: fallbackConfirmation(outcome.success) }]
    }
  }

  const replyText =
    extractText(finalContent) || "Could you tell me a bit more about what you're looking for?"

  try {
    await saveMessage(conversation.id, 'ASSISTANT', replyText)
  } catch (error) {
    // The visitor already has a valid reply at this point — failing to
    // persist it for future context shouldn't turn into a 500 they see.
    logger.error('ai.save_assistant_message_error', error, { conversationId: conversation.id })
  }

  return { reply: replyText, sessionId: conversation.sessionId, leadCaptured }
}

async function trySaveLead(
  conversationId: string,
  rawInput: unknown,
): Promise<{ success: boolean; reason?: string }> {
  const parsed = saveLeadInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    logger.warn('ai.save_lead.invalid_input', { conversationId })
    return { success: false, reason: 'The details provided were incomplete or invalid.' }
  }

  try {
    await prisma.qualifiedLead.create({ data: { conversationId, ...parsed.data } })
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { status: 'QUALIFIED', visitorName: parsed.data.name, visitorEmail: parsed.data.email },
    })
    return { success: true }
  } catch (error) {
    logger.error('ai.save_lead.db_error', error, { conversationId })
    return { success: false, reason: 'A temporary error occurred while saving.' }
  }
}

function fallbackConfirmation(success: boolean): string {
  return success
    ? "Thanks — I've passed your details to the Velnora team, they'll follow up by email."
    : "I wasn't able to save your details just now. Please use the contact form on the site so the team gets your project details directly."
}

function extractText(content: AIContentBlock[]): string {
  return content
    .filter((block): block is Extract<AIContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

async function findOrCreateConversation(sessionId: string | undefined) {
  if (sessionId) {
    const existing = await prisma.aIConversation.findUnique({ where: { sessionId } })
    if (existing) return existing
  }
  // A client-supplied sessionId that doesn't match anything (expired,
  // never existed, or absent) always starts a *new* row with a freshly
  // minted id — the client's string is a lookup key only, never used as
  // the id of a row it didn't already own.
  return prisma.aIConversation.create({ data: { sessionId: randomUUID() } })
}

async function saveMessage(conversationId: string, role: 'USER' | 'ASSISTANT', content: string) {
  await prisma.aIMessage.create({ data: { conversationId, role, content } })
}

async function loadHistory(conversationId: string): Promise<ProviderMessage[]> {
  // Most recent N messages, restored to chronological order — `take`
  // with an ascending sort would instead grab the OLDEST N.
  const rows = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORY_MESSAGES,
  })
  return rows
    .reverse()
    .map((row) => ({ role: row.role === 'USER' ? 'user' : 'assistant', content: row.content }))
}
