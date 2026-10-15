import type { Request, Response } from 'express'
import { getSidebarCounts, type SidebarCounts } from '../services/adminCounts.service.js'
import type { ApiResponse } from '../types/api.js'

export async function getAdminCounts(_req: Request, res: Response) {
  const counts = await getSidebarCounts()
  const response: ApiResponse<SidebarCounts> = { success: true, message: 'OK', data: counts }
  // Private, per-moment admin data: never stored by a browser or shared cache.
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(response)
}
