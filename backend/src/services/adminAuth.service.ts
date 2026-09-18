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
 * - `secure`: required in production (HTTPS-only), and mandatory
 *   whenever `sameSite: 'none'` is used (browsers refuse a non-secure
 *   `SameSite=None` cookie outright); relaxed in local dev since
 *   http://localhost has no TLS.
 * - `sameSite`: `'none'` in production, `'lax'` in development. This was
 *   originally `'lax'` everywhere on the assumption that the frontend and
 *   backend would be subdomains of one registrable domain in production
 *   (e.g. app.velnora.com / api.velnora.com) — genuinely same-site, where
 *   Lax is both sufficient and a real CSRF defense. The actual current
 *   deployment is Vercel (*.vercel.app) + Render (*.onrender.com), two
 *   completely different registrable domains — genuinely cross-site.
 *   Browsers never attach a `SameSite=Lax` cookie to a cross-site fetch
 *   at all, so with the original setting, login would succeed (the
 *   cookie gets set) but the very next request checking the session
 *   would silently look unauthenticated and bounce back to login — this
 *   exact bug was hit live. Local dev stays `'lax'`: `localhost:5173`
 *   and `localhost:4000` are different ports but the same *site*
 *   (browsers don't treat ports as a site boundary, and `localhost` has
 *   no registrable-domain suffix to differ on), so Lax already works
 *   there and needs no `Secure` requirement against plain http.
 *
 *   Losing Lax's ambient-credential CSRF defense in production is an
 *   acceptable trade: every state-changing admin route only accepts
 *   JSON bodies, which forces a CORS preflight, and this backend's CORS
 *   config (see app.ts) never allows a wildcard origin — a disallowed
 *   origin's preflight fails and the browser never sends the real
 *   request at all. See SECURITY.md's "Admin Dashboard security"
 *   section for the full reasoning.
 */
export function adminSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    expires: expiresAt,
  }
}

export function clearedAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
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
  try {
    await prisma.adminSession.deleteMany({ where: { tokenHash } })
  } catch (error) {
    logger.error('admin.logout.failed', error)
  }
}

/**
 * Looks up the admin behind a raw session token from a cookie. Returns
 * null for a missing, unknown, or expired session — callers never learn
 * which of those it was, they all mean "not authenticated."
 */
export async function getAdminBySessionToken(sessionToken: string): Promise<AdminSessionUser | null> {
  const tokenHash = hashToken(sessionToken)

  let session: { expiresAt: Date; adminUser: { id: string; email: string } } | null
  try {
    session = await prisma.adminSession.findUnique({ where: { tokenHash }, include: { adminUser: true } })
  } catch (error) {
    throw new AppError(500, 'A database error occurred while checking your session. Please try again shortly.', undefined, {
      cause: error,
    })
  }

  if (!session || session.expiresAt.getTime() <= Date.now()) return null

  // Fire-and-forget: a session's "last used" timestamp is observability,
  // not something a request should ever wait on or fail over.
  prisma.adminSession.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } }).catch(() => {})

  return { id: session.adminUser.id, email: session.adminUser.email }
}
