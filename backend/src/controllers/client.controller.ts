import type { Request, Response } from 'express'
import {
  CLIENT_SESSION_COOKIE_NAME,
  clearedClientSessionCookieOptions,
  clientSessionCookieOptions,
  loginClient,
  logoutClient,
  registerClient,
} from '../services/clientAuth.service.js'
import { createClientProject, getClientProject, getClientProjectHistory, listClientProjects } from '../services/project.service.js'
import type { ApiResponse } from '../types/api.js'
import type { ClientLoginInput, ClientRegisterInput } from '../validators/clientAuth.validator.js'
import type { ProjectCreateInput } from '../validators/project.validator.js'

/**
 * Every project handler below takes the client's identity from
 * `req.clientUser` (set by requireClientSession from the session cookie)
 * and from nowhere else — not the body, not the URL. `req.params.id` is
 * only a lookup key, scoped by that identity inside the service.
 */

export async function postClientRegister(req: Request, res: Response) {
  const { name, email, password, phone, company } = req.body as ClientRegisterInput
  const { sessionToken, expiresAt, client } = await registerClient(
    { name, email, password, phone, company },
    { ipAddress: req.ip, userAgent: req.header('user-agent') },
  )
  res.cookie(CLIENT_SESSION_COOKIE_NAME, sessionToken, clientSessionCookieOptions(expiresAt))
  const response: ApiResponse = { success: true, message: 'Account created.', data: { client } }
  res.status(201).json(response)
}

export async function postClientLogin(req: Request, res: Response) {
  const { email, password } = req.body as ClientLoginInput
  const { sessionToken, expiresAt, client } = await loginClient(email, password, {
    ipAddress: req.ip,
    userAgent: req.header('user-agent'),
  })
  res.cookie(CLIENT_SESSION_COOKIE_NAME, sessionToken, clientSessionCookieOptions(expiresAt))
  const response: ApiResponse = { success: true, message: 'Logged in.', data: { client } }
  res.status(200).json(response)
}

export async function postClientLogout(req: Request, res: Response) {
  const token = req.cookies?.[CLIENT_SESSION_COOKIE_NAME] as string | undefined
  if (token) await logoutClient(token)
  res.clearCookie(CLIENT_SESSION_COOKIE_NAME, clearedClientSessionCookieOptions())
  const response: ApiResponse = { success: true, message: 'Logged out.' }
  res.status(200).json(response)
}

export async function getClientSession(req: Request, res: Response) {
  const response: ApiResponse = { success: true, message: 'OK', data: { client: req.clientUser } }
  res.status(200).json(response)
}

export async function getClientProjects(req: Request, res: Response) {
  const data = await listClientProjects(req.clientUser!.id)
  const response: ApiResponse = { success: true, message: 'OK', data }
  res.status(200).json(response)
}

export async function postClientProject(req: Request, res: Response) {
  const project = await createClientProject(req.clientUser!.id, req.clientUser!.email, req.body as ProjectCreateInput)
  const response: ApiResponse = { success: true, message: 'Your project request has been received.', data: { project } }
  res.status(201).json(response)
}

export async function getClientProjectById(req: Request, res: Response) {
  const project = await getClientProject(req.clientUser!.id, req.params.id as string)
  const response: ApiResponse = { success: true, message: 'OK', data: { project } }
  res.status(200).json(response)
}

export async function getClientProjectStatusHistory(req: Request, res: Response) {
  const data = await getClientProjectHistory(req.clientUser!.id, req.params.id as string)
  const response: ApiResponse = { success: true, message: 'OK', data }
  res.status(200).json(response)
}
