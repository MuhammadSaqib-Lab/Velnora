import type { Request, Response } from 'express'
import { handleChatMessage } from '../services/aiChat.service.js'
import type { ChatRequestInput } from '../validators/aiChat.validator.js'
import type { ApiResponse } from '../types/api.js'

export async function postChatMessage(req: Request, res: Response) {
  const { sessionId, message } = req.body as ChatRequestInput
  const result = await handleChatMessage(sessionId, message)

  const response: ApiResponse<{ sessionId: string; leadCaptured: boolean }> = {
    success: true,
    message: result.reply,
    data: { sessionId: result.sessionId, leadCaptured: result.leadCaptured },
  }
  res.status(200).json(response)
}
