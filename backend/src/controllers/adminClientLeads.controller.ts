import type { Request, Response } from 'express'
import {
  getClientLead,
  getClientLeadConversation,
  listClientLeads,
  updateClientLeadStatus,
} from '../services/adminClientLeads.service.js'
import type { ClientLeadListQuery, ClientLeadStatusUpdateInput } from '../validators/adminClientLeads.validator.js'
import type { ApiResponse } from '../types/api.js'

export async function getClientLeads(_req: Request, res: Response) {
  const query = res.locals.query as ClientLeadListQuery
  const result = await listClientLeads(query)
  const response: ApiResponse = { success: true, message: 'OK', data: result }
  res.status(200).json(response)
}

export async function getClientLeadById(req: Request, res: Response) {
  const lead = await getClientLead(req.params.id as string)
  const response: ApiResponse = { success: true, message: 'OK', data: lead }
  res.status(200).json(response)
}

export async function getClientLeadConversationById(req: Request, res: Response) {
  const conversation = await getClientLeadConversation(req.params.id as string)
  const response: ApiResponse = { success: true, message: 'OK', data: conversation }
  res.status(200).json(response)
}

export async function patchClientLeadStatus(req: Request, res: Response) {
  const { status } = req.body as ClientLeadStatusUpdateInput
  const lead = await updateClientLeadStatus(req.params.id as string, status)
  const response: ApiResponse = { success: true, message: 'Status updated.', data: lead }
  res.status(200).json(response)
}
