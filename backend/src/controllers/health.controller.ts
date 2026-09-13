import type { Request, Response } from 'express'
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

  const response: ApiResponse<{ databaseConnected: boolean; timestamp: string }> = {
    success: true,
    message: 'OK',
    data: { databaseConnected, timestamp: new Date().toISOString() },
  }

  res.status(databaseConnected ? 200 : 503).json(response)
}
