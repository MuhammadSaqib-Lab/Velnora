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

  // Whether the AI Consultant / Lead Finder providers are configured at
  // all — never a live call to any of them, which would turn a health
  // check into a billable request. A provider being unreachable doesn't
  // affect overall API health; each feature's own endpoints handle that
  // failure on their own.
  const aiConfigured = Boolean(env.ANTHROPIC_API_KEY)
  const leadSearchConfigured = Boolean(env.GOOGLE_PLACES_API_KEY)
  const gmailConfigured = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI && env.GOOGLE_REFRESH_TOKEN,
  )

  const response: ApiResponse<{
    databaseConnected: boolean
    aiConfigured: boolean
    leadSearchConfigured: boolean
    gmailConfigured: boolean
    timestamp: string
  }> = {
    success: true,
    message: 'OK',
    data: { databaseConnected, aiConfigured, leadSearchConfigured, gmailConfigured, timestamp: new Date().toISOString() },
  }

  res.status(databaseConnected ? 200 : 503).json(response)
}
