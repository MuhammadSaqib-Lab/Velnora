import type { Request, Response } from 'express'
import { getAdminProject, listAdminProjects, updateProjectStatus } from '../services/project.service.js'
import type { ApiResponse } from '../types/api.js'
import type { AdminProjectListQuery, ProjectStatusUpdateInput } from '../validators/project.validator.js'

export async function getAdminProjects(_req: Request, res: Response) {
  const data = await listAdminProjects(res.locals.query as AdminProjectListQuery)
  const response: ApiResponse = { success: true, message: 'OK', data }
  res.status(200).json(response)
}

export async function getAdminProjectById(req: Request, res: Response) {
  const project = await getAdminProject(req.params.id as string)
  const response: ApiResponse = { success: true, message: 'OK', data: { project } }
  res.status(200).json(response)
}

export async function patchAdminProjectStatus(req: Request, res: Response) {
  const { status, message } = req.body as ProjectStatusUpdateInput
  // The editor's identity is the admin session's, never a body field.
  const project = await updateProjectStatus(req.params.id as string, status, message, req.adminUser!.email)
  const response: ApiResponse = { success: true, message: 'Project status updated.', data: { project } }
  res.status(200).json(response)
}
