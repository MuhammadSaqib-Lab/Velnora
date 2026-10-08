import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import type { AdminProjectListQuery, ProjectCreateInput, ProjectStatusValue } from '../validators/project.validator.js'
import { notifyProjectSubmitted, notifyProjectStatusChanged } from './projectNotifications.service.js'

/**
 * Client Portal projects.
 *
 * Ownership rule, enforced here and nowhere else in the request path:
 * every client-facing function takes the `clientId` that the
 * requireClientSession middleware derived from the session cookie and
 * scopes EVERY query by it (`where: { id, clientId }`). A project that
 * exists but belongs to someone else is indistinguishable from one that
 * doesn't exist (both 404), so ids can't be probed. The route param is
 * only ever a lookup key, never an authorization decision.
 */

/** Public-facing project number: VEL-1001, VEL-1002… from a DB sequence (race-free). */
const PROJECT_NUMBER_BASE = 1000
const MAX_PROJECTS_PER_CLIENT = 25
const NOT_FOUND = 'Project not found.'

export function toProjectNumber(seq: number): string {
  return `VEL-${PROJECT_NUMBER_BASE + seq}`
}

function seqFromProjectNumber(search: string): number | null {
  const match = /^VEL-?(\d{1,9})$/i.exec(search.trim())
  if (!match) return null
  const seq = Number(match[1]) - PROJECT_NUMBER_BASE
  return seq > 0 ? seq : null
}

type ProjectRow = {
  id: string
  projectSeq: number
  projectName: string
  projectType: string
  description: string
  websiteUrl: string | null
  targetAudience: string | null
  requiredFeatures: string | null
  budgetRange: string | null
  timeline: string | null
  additionalNotes: string | null
  status: ProjectStatusValue
  createdAt: Date
  updatedAt: Date
}

type HistoryRow = {
  id: string
  oldStatus: ProjectStatusValue | null
  newStatus: ProjectStatusValue
  message: string | null
  changedBy: string | null
  createdAt: Date
}

type ClientRow = { name: string; email: string; phone: string | null; company: string | null }

/**
 * What a CLIENT may see. An explicit field list (never a spread of the
 * row) so a future column can't leak by default — notably no `clientId`,
 * no `projectSeq`, and (for history) no `changedBy`, which is the admin's
 * email.
 */
function toClientProjectDto(row: ProjectRow) {
  return {
    id: row.id,
    projectNumber: toProjectNumber(row.projectSeq),
    projectName: row.projectName,
    projectType: row.projectType,
    description: row.description,
    websiteUrl: row.websiteUrl,
    targetAudience: row.targetAudience,
    requiredFeatures: row.requiredFeatures,
    budgetRange: row.budgetRange,
    timeline: row.timeline,
    additionalNotes: row.additionalNotes,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toClientHistoryDto(row: HistoryRow) {
  return { id: row.id, oldStatus: row.oldStatus, newStatus: row.newStatus, message: row.message, createdAt: row.createdAt }
}

function dbError(message: string, cause: unknown): AppError {
  return new AppError(500, message, undefined, { cause })
}

// ───────────────────────────── client-facing ─────────────────────────────

export async function createClientProject(clientId: string, clientEmail: string, input: ProjectCreateInput) {
  try {
    const existing = await prisma.project.count({ where: { clientId } })
    if (existing >= MAX_PROJECTS_PER_CLIENT) {
      throw new AppError(
        409,
        'You have reached the maximum number of projects for one account. Please contact us to discuss further work.',
      )
    }

    // One nested create = one atomic write: the project and its first
    // history entry both exist or neither does.
    const project = await prisma.project.create({
      data: {
        clientId,
        projectName: input.projectName,
        projectType: input.projectType,
        description: input.description,
        websiteUrl: input.websiteUrl,
        targetAudience: input.targetAudience,
        requiredFeatures: input.requiredFeatures,
        budgetRange: input.budgetRange,
        timeline: input.timeline,
        additionalNotes: input.additionalNotes,
        status: 'NEW_REQUEST',
        statusHistory: {
          create: { oldStatus: null, newStatus: 'NEW_REQUEST', message: 'Project submitted', changedBy: 'client' },
        },
      },
    })

    // Metadata only — never the project text.
    logger.info('project.created', { projectId: project.id, clientId })
    notifyProjectSubmitted({ projectId: project.id, projectNumber: toProjectNumber(project.projectSeq), clientEmail })
    return toClientProjectDto(project as ProjectRow)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw dbError('A database error occurred while saving your project. Please try again shortly.', error)
  }
}

export async function listClientProjects(clientId: string) {
  try {
    const rows = await prisma.project.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: MAX_PROJECTS_PER_CLIENT,
    })
    return { projects: (rows as ProjectRow[]).map(toClientProjectDto) }
  } catch (error) {
    throw dbError('A database error occurred while loading your projects.', error)
  }
}

async function findOwnedProject(clientId: string, id: string): Promise<ProjectRow> {
  let row
  try {
    row = await prisma.project.findFirst({ where: { id, clientId } })
  } catch (error) {
    throw dbError('A database error occurred while loading this project.', error)
  }
  if (!row) throw new AppError(404, NOT_FOUND)
  return row as ProjectRow
}

export async function getClientProject(clientId: string, id: string) {
  return toClientProjectDto(await findOwnedProject(clientId, id))
}

export async function getClientProjectHistory(clientId: string, id: string) {
  // Ownership is verified BEFORE the history table is touched at all.
  await findOwnedProject(clientId, id)
  try {
    const rows = await prisma.projectStatusHistory.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
    })
    return { history: (rows as HistoryRow[]).map(toClientHistoryDto) }
  } catch (error) {
    throw dbError('A database error occurred while loading this project.', error)
  }
}

// ───────────────────────────── admin-facing ──────────────────────────────

const CLIENT_SELECT = { select: { name: true, email: true, phone: true, company: true } } as const

function toAdminProjectDto(row: ProjectRow & { client: ClientRow }) {
  return {
    ...toClientProjectDto(row),
    client: {
      name: row.client.name,
      email: row.client.email,
      phone: row.client.phone,
      company: row.client.company,
    },
  }
}

export async function listAdminProjects(query: AdminProjectListQuery) {
  const search = query.search?.trim()
  const seq = search ? seqFromProjectNumber(search) : null

  const where: Prisma.ProjectWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(search
      ? {
          OR: [
            { projectName: { contains: search, mode: 'insensitive' as const } },
            { client: { name: { contains: search, mode: 'insensitive' as const } } },
            { client: { email: { contains: search, mode: 'insensitive' as const } } },
            { client: { company: { contains: search, mode: 'insensitive' as const } } },
            ...(seq ? [{ projectSeq: seq }] : []),
          ],
        }
      : {}),
  }

  const orderBy: Prisma.ProjectOrderByWithRelationInput =
    query.sort === 'oldest' ? { createdAt: 'asc' } : query.sort === 'updated_desc' ? { updatedAt: 'desc' } : { createdAt: 'desc' }

  try {
    const [rows, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { client: CLIENT_SELECT },
      }),
      prisma.project.count({ where }),
    ])
    return {
      projects: (rows as Array<ProjectRow & { client: ClientRow }>).map(toAdminProjectDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  } catch (error) {
    throw dbError('A database error occurred while listing projects.', error)
  }
}

export async function getAdminProject(id: string) {
  let row
  try {
    row = await prisma.project.findUnique({
      where: { id },
      include: { client: CLIENT_SELECT, statusHistory: { orderBy: { createdAt: 'asc' } } },
    })
  } catch (error) {
    throw dbError('A database error occurred while loading this project.', error)
  }
  if (!row) throw new AppError(404, NOT_FOUND)

  const typed = row as ProjectRow & { client: ClientRow; statusHistory: HistoryRow[] }
  return {
    ...toAdminProjectDto(typed),
    // Admins also see who made each change.
    statusHistory: typed.statusHistory.map((entry) => ({ ...toClientHistoryDto(entry), changedBy: entry.changedBy })),
  }
}

/**
 * Only reachable from the admin-session-gated route. Status is validated
 * against the enum upstream; here we additionally refuse a no-op change
 * (it would only add noise to the client's timeline) and use a
 * compare-and-set on the current status so two admins acting at once
 * can't silently overwrite each other.
 */
export async function updateProjectStatus(id: string, status: ProjectStatusValue, message: string | undefined, adminEmail: string) {
  const current = await getAdminProject(id)

  if (current.status === status) {
    throw new AppError(409, 'The project already has that status.')
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.project.updateMany({ where: { id, status: current.status }, data: { status } })
      if (result.count !== 1) return false

      await tx.projectStatusHistory.create({
        data: { projectId: id, oldStatus: current.status, newStatus: status, message: message ?? null, changedBy: adminEmail },
      })
      return true
    })

    if (!updated) {
      throw new AppError(409, 'This project was updated by someone else. Reload and try again.')
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw dbError('A database error occurred while updating the project status.', error)
  }

  logger.info('project.status_changed', { projectId: id, from: current.status, to: status, changedBy: adminEmail })
  notifyProjectStatusChanged({
    projectId: id,
    projectNumber: current.projectNumber,
    clientEmail: current.client.email,
    newStatus: status,
  })
  return getAdminProject(id)
}
