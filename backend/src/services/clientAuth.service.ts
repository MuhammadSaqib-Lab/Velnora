import { createHash, randomBytes } from 'node:crypto'
import { env, isProduction } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { hashPassword, verifyPasswordOrDummy } from '../utils/passwordHash.js'

/**
 * Client Portal authentication. Deliberately the same shape as the Admin
 * Dashboard's (adminAuth.service.ts) — httpOnly cookie carrying a random
 * token, only its SHA-256 digest stored, bcrypt passwords — but it is a
 * separate cookie and a separate table on purpose: a client session can
 * never satisfy requireAdminSession(), and an admin session never counts
 * as a client. The accounts themselves are `User` rows (the model that
 * was prepared for exactly this), not a third account type.
 */
export const CLIENT_SESSION_COOKIE_NAME = 'velnora_client_session'

export interface ClientSessionUser {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
}

type UserRow = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

function toSessionUser(row: UserRow): ClientSessionUser {
  // Explicit field list — never spread a User row (it carries passwordHash).
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, company: row.company }
}

/**
 * `httpOnly` (never readable by page JS), `secure` in production,
 * `sameSite: 'lax'` — the frontend proxies /api/* through its own origin
 * (see the root vercel.json rewrite and vite.config.ts), so this is a
 * genuinely same-site cookie; Lax also means a cross-site form POST
 * never carries it, which is the CSRF defense for this API's JSON-only
 * write endpoints. Same reasoning as the admin cookie, see
 * adminAuth.service.ts and SECURITY.md.
 */
export function clientSessionCookieOptions(expiresAt: Date) {
  return { httpOnly: true, secure: isProduction, sameSite: 'lax' as const, path: '/', expires: expiresAt }
}

export function clearedClientSessionCookieOptions() {
  return { httpOnly: true, secure: isProduction, sameSite: 'lax' as const, path: '/' }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

async function createSession(userId: string, meta: { ipAddress?: string; userAgent?: string }) {
  const sessionToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + env.CLIENT_SESSION_TTL_MS)

  // Best-effort cleanup of this client's own expired sessions, same
  // approach as the admin login: cheap, and no separate sweep job needed.
  await prisma.clientSession.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
  await prisma.clientSession.create({
    data: { userId, tokenHash: hashToken(sessionToken), expiresAt, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
  })
  return { sessionToken, expiresAt }
}

export interface RegisterClientInput {
  name: string
  email: string
  password: string
  phone?: string
  company?: string
}

/**
 * Creates the account AND signs the client in (smoother than a redirect
 * to /login, and safe because the session is created server-side right
 * after the password is hashed). `role` is fixed to USER here — it is not
 * an input.
 *
 * A duplicate email returns a clear 409 (a deliberate UX trade-off:
 * sign-up forms can't be both friendly and non-enumerating). The
 * exposure is bounded by the tighter registration rate limiter; login
 * itself never reveals whether an email exists.
 */
export async function registerClient(
  input: RegisterClientInput,
  meta: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ sessionToken: string; expiresAt: Date; client: ClientSessionUser }> {
  const email = input.email.trim().toLowerCase()
  const duplicate = new AppError(409, 'An account with this email already exists. Try logging in instead.')

  try {
    if (await prisma.user.findUnique({ where: { email } })) throw duplicate

    const passwordHash = await hashPassword(input.password)
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        role: 'USER',
        phone: input.phone,
        company: input.company,
        lastLoginAt: new Date(),
      },
    })
    const session = await createSession(user.id, meta)
    logger.info('client.registered', { clientId: user.id })
    return { ...session, client: toSessionUser(user) }
  } catch (error) {
    if (error instanceof AppError) throw error
    // Lost a race against another sign-up with the same email.
    if (isUniqueViolation(error)) throw duplicate
    throw new AppError(500, 'A database error occurred while creating your account. Please try again shortly.', undefined, {
      cause: error,
    })
  }
}

export async function loginClient(
  emailInput: string,
  password: string,
  meta: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ sessionToken: string; expiresAt: Date; client: ClientSessionUser }> {
  const email = emailInput.trim().toLowerCase()

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    const matches = await verifyPasswordOrDummy(password, user?.passwordHash ?? null)

    if (!user || !matches) {
      // Identical for "no such account" and "wrong password".
      throw new AppError(401, 'Invalid email or password.')
    }

    const session = await createSession(user.id, meta)
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    return { ...session, client: toSessionUser(user) }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(500, 'A database error occurred while signing in. Please try again shortly.', undefined, {
      cause: error,
    })
  }
}

/** Idempotent, and a database error never blocks the cookie being cleared. */
export async function logoutClient(sessionToken: string): Promise<void> {
  try {
    await prisma.clientSession.deleteMany({ where: { tokenHash: hashToken(sessionToken) } })
  } catch (error) {
    logger.error('client.logout.failed', error)
  }
}

/** Null for a missing, unknown or expired session — callers never learn which. */
export async function getClientBySessionToken(sessionToken: string): Promise<ClientSessionUser | null> {
  const tokenHash = hashToken(sessionToken)

  let session: { expiresAt: Date; user: UserRow } | null
  try {
    session = await prisma.clientSession.findUnique({ where: { tokenHash }, include: { user: true } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while checking your session. Please try again shortly.', undefined, {
      cause: error,
    })
  }

  if (!session || !session.user || session.expiresAt.getTime() <= Date.now()) return null

  prisma.clientSession.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } }).catch(() => {})

  return toSessionUser(session.user)
}
