import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../database/prisma.js'
import { env, isProduction } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { hashPassword, verifyPassword } from '../utils/passwordHash.js'

export const ADMIN_SESSION_COOKIE_NAME = 'velnora_admin_session'

export interface AdminSessionUser {
  id: string
  email: string
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * A real bcrypt comparison run even when no account matches the
 * submitted email, so "no such admin" and "wrong password" take the same
 * amount of time — otherwise timing alone would let an attacker enumerate
 * which email addresses have an admin account. Computed once per process
 * (bcrypt is deliberately slow) rather than on every failed login.
 */
let dummyHashPromise: Promise<string> | null = null
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(randomBytes(24).toString('hex'))
  return dummyHashPromise
}

/**
 * Cookie options for the admin session cookie, shared between setting it
 * (login) and clearing it (logout / an expired session hit mid-request).
 *
 * - `httpOnly`: never readable from frontend JavaScript, the only way an
 *   XSS bug could steal it.
 * - `secure`: required in production (HTTPS-only); relaxed in local dev
 *   since http://localhost has no TLS.
 * - `sameSite: 'lax'`: this only stays correct because the frontend
 *   proxies `/api/*` to this backend rather than calling it cross-origin
 *   directly (see the root `vercel.json`'s rewrite and `vite.config.ts`'s
 *   dev-server proxy for the local equivalent) — from the browser's
 *   perspective every request targets the frontend's own origin, so this
 *   is genuinely same-site regardless of where the backend actually
 *   runs. This went through two broken iterations before landing here:
 *   plain `'lax'` while the frontend called Render directly (a genuinely
 *   cross-site request) meant browsers never attached the cookie to the
 *   session-check call right after a successful login, silently bouncing
 *   the admin back to the login page; switching to `'none'` fixed that
 *   but then ran into third-party-cookie blocking (a separate browser
 *   privacy feature — e.g. Chrome's "Block third-party cookies", Safari's
 *   ITP — that rejects a cross-site cookie regardless of `SameSite`).
 *   Routing every request through one origin via the proxy fixes the
 *   root cause instead of chasing further cookie-attribute exceptions to
 *   it, and restores `'lax'`'s ambient-credential CSRF protection as a
 *   bonus. See SECURITY.md's "Admin Dashboard security" section.
 */
export function adminSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  }
}

export function clearedAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
  }
}

/**
 * Runs once at server startup (see server.ts). Creates the very first
 * AdminUser from ADMIN_EMAIL/ADMIN_PASSWORD if, and only if, no account
 * exists yet with that email — it never overwrites an existing account's
 * password, so restarting the server with the same env vars set is a
 * safe no-op, not a silent password reset. ADMIN_PASSWORD is hashed
 * immediately; the plaintext value is never stored, logged, or returned
 * by any endpoint, and this function never throws on a missing/invalid
 * env pair, it just skips bootstrapping.
 */
export async function bootstrapInitialAdminUser(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return

  const email = env.ADMIN_EMAIL.trim().toLowerCase()
  const existing = await prisma.adminUser.findUnique({ where: { email } })
  if (existing) return

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD)
  await prisma.adminUser.create({ data: { email, passwordHash } })
  logger.info('admin.bootstrap.created', { email })
}

export async function loginAdmin(
  email: string,
  password: string,
  meta: { ipAddress?: string; userAgent?: string } = {},
): Promise<{ sessionToken: string; expiresAt: Date; admin: AdminSessionUser }> {
  const normalizedEmail = email.trim().toLowerCase()

  let adminUser: { id: string; email: string; passwordHash: string } | null
  try {
    adminUser = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while signing in. Please try again shortly.', undefined, { cause: error })
  }

  const passwordHash = adminUser?.passwordHash ?? (await getDummyHash())
  const passwordMatches = await verifyPassword(password, passwordHash)

  if (!adminUser || !passwordMatches) {
    // Deliberately identical for "no such account" and "wrong password" —
    // never reveal which one it was.
    throw new AppError(401, 'Invalid email or password.')
  }

  const sessionToken = generateSessionToken()
  const tokenHash = hashToken(sessionToken)
  const expiresAt = new Date(Date.now() + env.ADMIN_SESSION_TTL_MS)

  try {
    // Best-effort cleanup of this admin's own expired sessions on login,
    // not a full table sweep — cheap, and keeps admin_sessions from
    // growing unbounded without needing a separate scheduled job.
    await prisma.adminSession.deleteMany({ where: { adminUserId: adminUser.id, expiresAt: { lt: new Date() } } })

    await prisma.adminSession.create({
      data: {
        adminUserId: adminUser.id,
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    })
    await prisma.adminUser.update({ where: { id: adminUser.id }, data: { lastLoginAt: new Date() } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while signing in. Please try again shortly.', undefined, { cause: error })
  }

  return { sessionToken, expiresAt, admin: { id: adminUser.id, email: adminUser.email } }
}

/**
 * Idempotent: logging out twice, or logging out a session that already
 * expired/was never valid, is never an error, it just ends in the same
 * "no session" state either way. A database error here is logged, not
 * thrown — the cookie still gets cleared client-side either way (see
 * adminAuth.controller.ts), and a user asking to log out should never be
 * shown a scary error for it.
 */
export async function logoutAdmin(sessionToken: string): Promise<void> {
  const tokenHash = hashToken(sessionToken)
  forgetVerifiedSession(tokenHash)
  try {
    await prisma.adminSession.deleteMany({ where: { tokenHash } })
  } catch (error) {
    logger.error('admin.logout.failed', error)
  }
}

/**
 * A dashboard page load fires several authenticated requests at once (the
 * session check, the sidebar counts, the page's own data), and every one of
 * them used to cost two database round trips plus a write. Verified sessions
 * are therefore remembered in this process for a few seconds, and concurrent
 * lookups for the same token share one query.
 *
 * Safety properties, each covered by tests:
 *  - keyed by the token's SHA-256 hash (the raw token is never held), and an
 *    entry only ever answers for the exact token that produced it;
 *  - only successful verifications are cached (an unknown/expired token is
 *    re-checked every time) and an entry is never served past the session's
 *    own expiry;
 *  - logging out evicts the entry immediately on this instance;
 *  - the cache is per process, so a session revoked by other means (deleted
 *    in the database, or logged out through another instance) stays usable
 *    for at most SESSION_CACHE_TTL_MS.
 */
export const SESSION_CACHE_TTL_MS = 10_000
const SESSION_CACHE_MAX_ENTRIES = 500
/** How stale `lastUsedAt` may get before a request bothers to write it again. */
export const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000

interface VerifiedSession {
  admin: AdminSessionUser
  sessionExpiresAt: number
  cachedUntil: number
}
const verifiedSessions = new Map<string, VerifiedSession>()
/** One in-flight lookup per token; `ticket` lets a lookup tell whether a logout cancelled it. */
const pendingLookups = new Map<string, { ticket: symbol; promise: Promise<AdminSessionUser | null> }>()

function forgetVerifiedSession(tokenHash: string) {
  verifiedSessions.delete(tokenHash)
  pendingLookups.delete(tokenHash)
}

/** Test hook: start from a cold cache. */
export function clearAdminSessionCache() {
  verifiedSessions.clear()
  pendingLookups.clear()
}

function rememberVerifiedSession(tokenHash: string, entry: VerifiedSession) {
  if (verifiedSessions.size >= SESSION_CACHE_MAX_ENTRIES) {
    const now = Date.now()
    for (const [key, value] of verifiedSessions) if (value.cachedUntil <= now) verifiedSessions.delete(key)
    // Still full of live entries: drop the oldest insertion rather than grow without bound.
    if (verifiedSessions.size >= SESSION_CACHE_MAX_ENTRIES) {
      const oldest = verifiedSessions.keys().next().value
      if (oldest !== undefined) verifiedSessions.delete(oldest)
    }
  }
  verifiedSessions.set(tokenHash, entry)
}

async function lookupSession(tokenHash: string, isStillCurrent: () => boolean): Promise<AdminSessionUser | null> {
  let session: { expiresAt: Date; lastUsedAt: Date | null; adminUser: { id: string; email: string } } | null
  try {
    // Only the columns the check needs: no password hash is ever loaded here.
    session = await prisma.adminSession.findUnique({
      where: { tokenHash },
      select: { expiresAt: true, lastUsedAt: true, adminUser: { select: { id: true, email: true } } },
    })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while checking your session. Please try again shortly.', undefined, {
      cause: error,
    })
  }

  const now = Date.now()
  if (!session || session.expiresAt.getTime() <= now) {
    verifiedSessions.delete(tokenHash)
    return null
  }

  // Observability, not authorization: write it at most every few minutes
  // instead of on every request, and never make a request wait on it.
  if (!session.lastUsedAt || now - session.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    prisma.adminSession.update({ where: { tokenHash }, data: { lastUsedAt: new Date(now) } }).catch(() => {})
  }

  const admin = { id: session.adminUser.id, email: session.adminUser.email }
  // A logout that landed while this query was running must not be undone by caching its result.
  if (isStillCurrent()) {
    rememberVerifiedSession(tokenHash, {
      admin,
      sessionExpiresAt: session.expiresAt.getTime(),
      cachedUntil: now + SESSION_CACHE_TTL_MS,
    })
  }
  return admin
}

/**
 * Looks up the admin behind a raw session token from a cookie. Returns
 * null for a missing, unknown, or expired session — callers never learn
 * which of those it was, they all mean "not authenticated."
 */
export async function getAdminBySessionToken(sessionToken: string): Promise<AdminSessionUser | null> {
  const tokenHash = hashToken(sessionToken)

  const cached = verifiedSessions.get(tokenHash)
  const now = Date.now()
  if (cached && now < cached.cachedUntil && now < cached.sessionExpiresAt) return { ...cached.admin }

  const pending = pendingLookups.get(tokenHash)
  if (pending) return pending.promise

  const ticket = Symbol('session-lookup')
  const promise = lookupSession(tokenHash, () => pendingLookups.get(tokenHash)?.ticket === ticket).finally(() => {
    // Only clear our own entry: a logout may have replaced or removed it meanwhile.
    if (pendingLookups.get(tokenHash)?.ticket === ticket) pendingLookups.delete(tokenHash)
  })
  pendingLookups.set(tokenHash, { ticket, promise })
  return promise
}
