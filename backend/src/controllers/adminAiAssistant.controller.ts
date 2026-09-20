import type { Request, Response } from 'express'
import { handleAssistantCommand, type SimulatedAction } from '../aiAssistant/orchestrator.service.js'
import { synthesizeSpeech, type SpeechResult } from '../aiAssistant/elevenLabs.service.js'
import type { AssistantCommandInput, AssistantSpeakInput } from '../validators/aiAssistant.validator.js'
import type { ApiResponse } from '../types/api.js'

export async function postAssistantCommand(req: Request, res: Response) {
  const { message, history } = req.body as AssistantCommandInput
  const result = await handleAssistantCommand(history, message)

  const response: ApiResponse<{ actions: SimulatedAction[] }> = {
    success: true,
    message: result.reply,
    data: { actions: result.actions },
  }
  res.status(200).json(response)
}

export async function postAssistantSpeak(req: Request, res: Response) {
  const { text } = req.body as AssistantSpeakInput
  const result = await synthesizeSpeech(text)

  const response: ApiResponse<SpeechResult> = {
    success: true,
    message: 'ok',
    data: result,
  }
  res.status(200).json(response)
}
