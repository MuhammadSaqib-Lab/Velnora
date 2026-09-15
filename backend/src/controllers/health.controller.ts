import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import type { ApiResponse } from '../types/api.js'

export async function getHealth(_req: Request, res: Response) {
  let databaseConnected = false
  try {
    await prisma.$queryRaw`SELECT 1`
    databaseConnected = true
  } catch {
    databaseConnected = false
  }

  // Whether the AI Consultant is configured at all — not a live call to
  // the AI provider, which would turn a health check into a billable
  // request. The AI provider being unreachable doesn't affect overall
  // API health; POST /api/ai/chat handles that failure on its own.
  const aiConfigured = Boolean(env.ANTHROPIC_API_KEY)

  const response: ApiResponse<{
    databaseConnected: boolean
    aiConfigured: boolean
    timestamp: string
  }> = {
    success: true,
    message: 'OK',
    data: { databaseConnected, aiConfigured, timestamp: new Date().toISOString() },
  }

  res.status(databaseConnected ? 200 : 503).json(response)
}
