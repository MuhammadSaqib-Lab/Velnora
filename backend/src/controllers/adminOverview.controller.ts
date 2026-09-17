import type { Request, Response } from 'express'
import { getOverview } from '../services/adminOverview.service.js'
import type { ApiResponse } from '../types/api.js'

export async function getAdminOverview(_req: Request, res: Response) {
  const overview = await getOverview()
  const response: ApiResponse = { success: true, message: 'OK', data: overview }
  res.status(200).json(response)
}
