import { createHash } from 'node:crypto'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'

process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({ prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables() } }))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')
const { LAST_USED_WRITE_INTERVAL_MS, SESSION_CACHE_TTL_MS, clearAdminSessionCache, getAdminBySessionToken, logoutAdmin } = await import('../src/services/adminAuth.service.js')

const db = prisma as unknown as ReturnType<typeof createAdminAuthTables>
const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const sha = (n: number) => `token-number-${n}-0123456789abcdef0123456789abcdef`

async function seedSession(token: string, over: { expiresAt?: Date; lastUsedAt?: Date | null } = {}) {
  db.seedAdminUser({ id: 'admin_1', email: 'owner@velnora.com', passwordHash: 'never-loaded-hash' })
  await db.adminSession.create({
    data: { adminUserId: 'admin_1', tokenHash: hash(token), expiresAt: over.expiresAt ?? new Date(Date.now() + 3_600_000), lastUsedAt: over.lastUsedAt === undefined ? new Date() : over.lastUsedAt },
  })
  db.adminSession.create.mockClear()
}

beforeEach(() => {
  clearAdminSessionCache()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('admin session lookup', () => {
  it('answers repeated requests from a short-lived cache, then checks the database again after the TTL', async () => {
    const token = sha(1)
    await seedSession(token)
    expect(await getAdminBySessionToken(token)).toEqual({ id: 'admin_1', email: 'owner@velnora.com' })
    expect(await getAdminBySessionToken(token)).toEqual({ id: 'admin_1', email: 'owner@velnora.com' })
    expect(await getAdminBySessionToken(token)).toEqual({ id: 'admin_1', email: 'owner@velnora.com' })
    expect(db.adminSession.findUnique).toHaveBeenCalledTimes(1)

    vi.useFakeTimers({ now: Date.now() + SESSION_CACHE_TTL_MS + 1, toFake: ['Date'] })
    await getAdminBySessionToken(token)
    expect(db.adminSession.findUnique).toHaveBeenCalledTimes(2)
  })

  it('shares ONE database lookup between requests that arrive together (a page load fires several)', async () => {
    const token = sha(2)
    await seedSession(token)
    const results = await Promise.all([1, 2, 3, 4, 5, 6].map(() => getAdminBySessionToken(token)))
    expect(results.every((r) => r?.email === 'owner@velnora.com')).toBe(true)
    expect(db.adminSession.findUnique).toHaveBeenCalledTimes(1)
  })

  it('never caches a failure: unknown tokens are re-checked every time', async () => {
    expect(await getAdminBySessionToken(sha(3))).toBeNull()
    expect(await getAdminBySessionToken(sha(3))).toBeNull()
    expect(db.adminSession.findUnique).toHaveBeenCalledTimes(2)
  })

  it('only answers for the exact token that was verified', async () => {
    await seedSession(sha(4))
    await getAdminBySessionToken(sha(4))
    expect(await getAdminBySessionToken(sha(4) + 'x')).toBeNull()
    expect(await getAdminBySessionToken(sha(5))).toBeNull()
  })

  it('stops serving a session the moment it expires, even inside the cache window', async () => {
    const token = sha(6)
    await seedSession(token, { expiresAt: new Date(Date.now() + 2_000) })
    expect(await getAdminBySessionToken(token)).not.toBeNull()
    vi.useFakeTimers({ now: Date.now() + 3_000, toFake: ['Date'] }) // 3 s later: expired, though the 10 s cache window is still open
    expect(await getAdminBySessionToken(token)).toBeNull()
  })

  it('logging out revokes access immediately — the cache does not outlive a logout', async () => {
    const token = sha(7)
    await seedSession(token)
    expect(await getAdminBySessionToken(token)).not.toBeNull()
    await logoutAdmin(token)
    expect(await getAdminBySessionToken(token)).toBeNull()
  })

  it('a lookup that was already running when the user logs out cannot re-cache the session afterwards', async () => {
    const token = sha(8)
    await seedSession(token)
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const realFind = db.adminSession.findUnique.getMockImplementation()!
    db.adminSession.findUnique.mockImplementationOnce(async (args) => {
      const row = await realFind(args) // reads the session while it still exists…
      await gate // …but only answers after the logout has happened
      return row
    })

    const inFlight = getAdminBySessionToken(token)
    await logoutAdmin(token)
    release()
    await inFlight // this one request was already past the check

    expect(await getAdminBySessionToken(token)).toBeNull() // but nothing stayed cached
  })

  it('writes lastUsedAt at most every few minutes, not on every request', async () => {
    const fresh = sha(9)
    await seedSession(fresh, { lastUsedAt: new Date() })
    await getAdminBySessionToken(fresh)
    expect(db.adminSession.update).not.toHaveBeenCalled()

    clearAdminSessionCache()
    const stale = sha(10)
    await seedSession(stale, { lastUsedAt: new Date(Date.now() - LAST_USED_WRITE_INTERVAL_MS - 60_000) })
    await getAdminBySessionToken(stale)
    expect(db.adminSession.update).toHaveBeenCalledTimes(1)
    expect(db.adminSession.update).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hash(stale) } }))
  })

  it('loads only the columns the check needs — the password hash is never read', async () => {
    const token = sha(11)
    await seedSession(token)
    await getAdminBySessionToken(token)
    const args = db.adminSession.findUnique.mock.calls[0]![0] as { select?: { adminUser?: { select?: Record<string, boolean> } }; include?: unknown }
    expect(args.include).toBeUndefined()
    expect(args.select?.adminUser?.select).toEqual({ id: true, email: true })
  })

  it('a database failure surfaces as an error (never as "logged out" or a cached success)', async () => {
    const token = sha(12)
    await seedSession(token)
    db.adminSession.findUnique.mockRejectedValueOnce(new Error('connection terminated'))
    await expect(getAdminBySessionToken(token)).rejects.toMatchObject({ statusCode: 500 })
    expect(await getAdminBySessionToken(token)).not.toBeNull() // and the next attempt works normally
  })
})

describe('admin session lookup through the HTTP stack', () => {
  it('a burst of parallel authenticated requests costs one session lookup', async () => {
    db.seedAdminUser({ id: 'admin_2', email: 'second@velnora.com', passwordHash: await hashPassword('Correct-Horse-Battery-Staple-9') })
    const agent = request.agent(createApp())
    expect((await agent.post('/api/auth/admin/login').send({ email: 'second@velnora.com', password: 'Correct-Horse-Battery-Staple-9' })).status).toBe(200)
    db.adminSession.findUnique.mockClear()

    const responses = await Promise.all([1, 2, 3, 4, 5].map(() => agent.get('/api/auth/admin/me')))
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(db.adminSession.findUnique).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(responses[0]!.body)).not.toMatch(/passwordHash|tokenHash/)
  })
})
