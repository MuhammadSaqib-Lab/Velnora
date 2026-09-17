import type { Request, Response } from 'express'
import {
  createDraftForLead,
  generateEmailForLead,
  getLeadWithScoreBreakdown,
  listLeads,
  reanalyzeLead,
  searchAndResearchLeads,
  updateLeadStatus,
} from '../services/leadFinder.service.js'
import { generateAuthUrl, exchangeCodeForRefreshToken } from '../leadFinder/gmail/GmailProvider.js'
import { AppError } from '../utils/AppError.js'
import type { CreateDraftInput, LeadListQuery, LeadSearchInput } from '../validators/leadSearch.validator.js'
import type { LeadStatusUpdateInput } from '../validators/leadStatus.validator.js'
import type { ApiResponse } from '../types/api.js'

export async function postSearch(req: Request, res: Response) {
  const input = req.body as LeadSearchInput
  const leads = await searchAndResearchLeads(input)

  const response: ApiResponse<{ leads: unknown[]; count: number }> = {
    success: true,
    message: `Researched ${leads.length} qualifying lead${leads.length === 1 ? '' : 's'}.`,
    data: { leads, count: leads.length },
  }
  res.status(200).json(response)
}

export async function postAnalyze(req: Request, res: Response) {
  const lead = await reanalyzeLead(req.params.id as string)
  const response: ApiResponse = { success: true, message: 'Lead re-analyzed.', data: lead }
  res.status(200).json(response)
}

export async function getLeads(_req: Request, res: Response) {
  const query = res.locals.query as LeadListQuery
  const result = await listLeads(query)
  const response: ApiResponse = { success: true, message: 'OK', data: result }
  res.status(200).json(response)
}

export async function getLeadById(req: Request, res: Response) {
  const lead = await getLeadWithScoreBreakdown(req.params.id as string)
  const response: ApiResponse = { success: true, message: 'OK', data: lead }
  res.status(200).json(response)
}

export async function postGenerateEmail(req: Request, res: Response) {
  const lead = await generateEmailForLead(req.params.id as string)
  const response: ApiResponse = { success: true, message: 'Email generated.', data: lead }
  res.status(200).json(response)
}

export async function postCreateDraft(req: Request, res: Response) {
  const { force } = req.body as CreateDraftInput
  const lead = await createDraftForLead(req.params.id as string, force)
  const response: ApiResponse = {
    success: true,
    message: 'Gmail draft created. Review and send it manually from Gmail — nothing is sent automatically.',
    data: lead,
  }
  res.status(200).json(response)
}

export async function patchStatus(req: Request, res: Response) {
  const { status } = req.body as LeadStatusUpdateInput
  const lead = await updateLeadStatus(req.params.id as string, status)
  const response: ApiResponse = { success: true, message: 'Status updated.', data: lead }
  res.status(200).json(response)
}

export async function getGmailAuthUrl(_req: Request, res: Response) {
  let authUrl: string
  try {
    authUrl = generateAuthUrl()
  } catch (error) {
    throw new AppError(503, 'Gmail OAuth is not configured yet.', undefined, { cause: error })
  }
  const response: ApiResponse<{ authUrl: string }> = {
    success: true,
    message: 'Visit this URL in a browser, signed into the Gmail account Velnora should draft into.',
    data: { authUrl },
  }
  res.status(200).json(response)
}

/**
 * Reached via Google's own browser redirect, not an authenticated API
 * call — see GmailProvider.ts's `pendingOAuthState` comment for why this
 * route is intentionally not behind requireAdminToken.ts. Renders a
 * plain-text page rather than JSON since a human is looking at this in a
 * browser, not a script parsing a response.
 */
export async function getGmailOAuthCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined
  const state = typeof req.query.state === 'string' ? req.query.state : undefined

  if (!code || !state) {
    res.status(400).type('text/plain').send('Missing code or state parameter.')
    return
  }

  let refreshToken: string
  try {
    refreshToken = await exchangeCodeForRefreshToken(code, state)
  } catch (error) {
    res
      .status(400)
      .type('text/plain')
      .send(`Gmail authorization failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    return
  }

  res
    .status(200)
    .type('text/plain')
    .send(
      [
        'Gmail authorized successfully.',
        '',
        'Copy the value below into backend/.env as GOOGLE_REFRESH_TOKEN, then restart the server:',
        '',
        refreshToken,
        '',
        'This value is only shown once and is not stored anywhere by this server — if you lose it, revoke access at https://myaccount.google.com/permissions and repeat the GET /api/leads/gmail/auth-url flow.',
      ].join('\n'),
    )
}
