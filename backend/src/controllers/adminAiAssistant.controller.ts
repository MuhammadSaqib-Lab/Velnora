import type { Request, Response } from 'express'
import { assertAiAssistantEnabled } from '../aiAssistant/featureFlag.js'
import type { AssistantCommandInput, AssistantSpeakInput } from '../validators/aiAssistant.validator.js'
import type { ApiResponse } from '../types/api.js'

/**
 * AI Assistant handlers — TEMPORARILY DISABLED (see aiAssistant/featureFlag.ts).
 *
 * The assistant's modules (orchestrator, ElevenLabs client, tools) are
 * loaded with a dynamic import only AFTER the flag check passes, so while
 * the feature is off none of that code is even loaded, let alone run, and
 * nothing is initialized at server start. The explicit check here is a
 * second layer behind the route gate (requireAiAssistantEnabled) — if a
 * future route forgets the gate, this still refuses.
 */

export async function postAssistantCommand(req: Request, res: Response) {
  assertAiAssistantEnabled()
  const { handleAssistantCommand } = await import('../aiAssistant/orchestrator.service.js')

  const { message, history } = req.body as AssistantCommandInput
  const result = await handleAssistantCommand(history, message)

  const response: ApiResponse<{ actions: typeof result.actions }> = {
    success: true,
    message: result.reply,
    data: { actions: result.actions },
  }
  res.status(200).json(response)
}

export async function postAssistantSpeak(req: Request, res: Response) {
  assertAiAssistantEnabled()
  const { synthesizeSpeech } = await import('../aiAssistant/elevenLabs.service.js')

  const { text } = req.body as AssistantSpeakInput
  const result = await synthesizeSpeech(text)

  const response: ApiResponse<typeof result> = {
    success: true,
    message: 'ok',
    data: result,
  }
  res.status(200).json(response)
}
