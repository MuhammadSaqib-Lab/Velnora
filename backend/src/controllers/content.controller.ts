import type { Request, Response } from 'express'
import { projects, services } from '../services/content.service.js'
import type { ApiResponse } from '../types/api.js'

export function getServices(_req: Request, res: Response) {
  const response: ApiResponse<typeof services> = {
    success: true,
    message: 'OK',
    data: services,
  }
  res.status(200).json(response)
}

export function getProjects(_req: Request, res: Response) {
  const response: ApiResponse<typeof projects> = {
    success: true,
    message: 'OK',
    data: projects,
  }
  res.status(200).json(response)
}
