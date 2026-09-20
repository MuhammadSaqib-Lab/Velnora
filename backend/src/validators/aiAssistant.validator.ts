import { z } from 'zod'

const historyItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
})

export const assistantCommandSchema = z
  .object({
    message: z.string().trim().min(1, 'Message is required').max(2000, 'Keep messages under 2000 characters.'),
    // Held client-side (no AIConversation-style DB persistence for this
    // feature, see backend/README.md's "AI Assistant" section) and
    // resent each request, capped here the same way MAX_HISTORY_MESSAGES
    // caps it server-side in orchestrator.service.ts.
    history: z.array(historyItemSchema).max(20).optional().default([]),
  })
  .strict()

export type AssistantCommandInput = z.infer<typeof assistantCommandSchema>

export const assistantSpeakSchema = z
  .object({
    text: z.string().trim().min(1, 'Text is required').max(2000, 'Keep replies under 2000 characters for speech.'),
  })
  .strict()

export type AssistantSpeakInput = z.infer<typeof assistantSpeakSchema>
