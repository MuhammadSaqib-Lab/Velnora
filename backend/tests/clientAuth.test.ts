import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'
import { createClientPortalTables } from './helpers/clientPortalTables.js'

// Generous on purpose: this file registers/logs in many times across
// tests that aren't about rate limiting. Dedicated coverage with real,
// low limits lives in clientPortalRateLimit.test.ts.
process.env.CLIENT_LOGIN_RATE_LIMIT_MAX = '1000'
process.env.CLIENT_REGISTER_RATE_LIMIT_MAX = '1000'
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables(), ...createClientPortalTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

const tables = prisma as unknown as ReturnType<typeof createClientPortalTables> & ReturnType<typeof createAdminAuthTables>

const VALID = {
  name: 'Jordan Ashworth',
  email: 'Jordan@Example.com',
  password: 'Correct-Horse-9-Battery',
  confirmPassword: 'Correct-Horse-9-Battery',
}

function cookiesOf(res: request.Response): string[] {
  const header = res.headers['set-cookie']
  return Array.isArray(header) ? header : header ? [header] : []
}

beforeEach(() => {
  vi.clearAllMocks()
  tables.reset()
})

describe('POST /api/client/auth/register', () => {
  it('creates the account, hashes the password, and signs the client in with a secure session cookie', async () => {
    const app = createApp()
    const res = await request(app).post('/api/client/auth/register').send({ ...VALID, phone: '+1 555 010 2030', company: 'Ashworth Bakery' })

    expect(res.status).toBe(201)
    expect(res.body.data.client).toMatchObject({ name: 'Jordan Ashworth', email: 'jordan@example.com', company: 'Ashworth Bakery' })

    const [stored] = tables.peek.users()
    expect(stored.email).toBe('jordan@example.com') // normalized
    expect(stored.role).toBe('USER')
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/) // real bcrypt, never plaintext
    expect(stored.passwordHash).not.toContain(VALID.password)

    const cookie = cookiesOf(res).find((c) => c.startsWith('velnora_client_session='))
    expect(cookie).toBeDefined()
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('is signed in immediately: the same agent can read its session right after sign-up', async () => {
    const agent = request.agent(createApp())
    await agent.post('/api/client/auth/register').send(VALID)
    const session = await agent.get('/api/client/session')

    expect(session.status).toBe(200)
    expect(session.body.data.client.email).toBe('jordan@example.com')
  })

  it('never returns the password, its hash, or the raw/hashed session token', async () => {
    const res = await request(createApp()).post('/api/client/auth/register').send(VALID)
    const raw = JSON.stringify(res.body)
    const [stored] = tables.peek.users()
    const token = cookiesOf(res)[0]!.split(';')[0]!.split('=')[1]!

    expect(raw).not.toContain(VALID.password)
    expect(raw).not.toContain(stored.passwordHash)
    expect(raw).not.toContain(token)
    expect(raw).not.toContain(tables.peek.sessions()[0]!.tokenHash)
    expect(res.body.data.client).not.toHaveProperty('passwordHash')
  })

  it('only ever stores the SHA-256 digest of the session token, never the raw token', async () => {
    const res = await request(createApp()).post('/api/client/auth/register').send(VALID)
    const token = cookiesOf(res)[0]!.split(';')[0]!.split('=')[1]!
    const [session] = tables.peek.sessions()

    expect(session!.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(session!.tokenHash).not.toBe(token)
  })

  it('rejects a duplicate email (case-insensitively) with 409 and creates nothing', async () => {
    const app = createApp()
    await request(app).post('/api/client/auth/register').send(VALID)
    const again = await request(app).post('/api/client/auth/register').send({ ...VALID, email: 'JORDAN@example.COM', name: 'Someone Else' })

    expect(again.status).toBe(409)
    expect(tables.peek.users()).toHaveLength(1)
    expect(cookiesOf(again).find((c) => c.startsWith('velnora_client_session='))).toBeUndefined()
  })

  it('handles a sign-up race (unique violation from the database) as a clean 409, not a 500', async () => {
    tables.user.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))
    const res = await request(createApp()).post('/api/client/auth/register').send(VALID)
    expect(res.status).toBe(409)
  })

  const INVALID: Array<[string, Record<string, unknown>]> = [
    ['a missing name', { name: '' }],
    ['an invalid email', { email: 'not-an-email' }],
    ['a short password', { password: 'Abc1', confirmPassword: 'Abc1' }],
    ['a password with no number', { password: 'onlylettersherepls', confirmPassword: 'onlylettersherepls' }],
    ['a password with no letter', { password: '12345678901234', confirmPassword: '12345678901234' }],
    ['a single repeated character', { password: 'aaaaaaaaaaaa', confirmPassword: 'aaaaaaaaaaaa' }],
    ['a password over bcrypt\'s 72-byte limit', { password: `${'a1'.repeat(40)}`, confirmPassword: `${'a1'.repeat(40)}` }],
    ['a password containing the email', { email: 'jordan@example.com', password: 'xxjordan@example.com1', confirmPassword: 'xxjordan@example.com1' }],
    ['mismatched passwords', { confirmPassword: 'Different-Pass-9' }],
    ['a missing confirmation', { confirmPassword: undefined }],
    ['a malformed phone', { phone: 'call me maybe' }],
  ]
  for (const [label, override] of INVALID) {
    it(`rejects ${label} with 400 and creates nothing`, async () => {
      const res = await request(createApp()).post('/api/client/auth/register').send({ ...VALID, ...override })
      expect(res.status).toBe(400)
      expect(tables.peek.users()).toHaveLength(0)
    })
  }

  it('rejects mass-assignment attempts (role, id, isAdmin, status) as 400 — they are never ignored silently', async () => {
    for (const extra of [{ role: 'ADMIN' }, { id: 'user_1' }, { isAdmin: true }, { passwordHash: 'x' }, { emailVerified: true }]) {
      const res = await request(createApp()).post('/api/client/auth/register').send({ ...VALID, ...extra })
      expect(res.status).toBe(400)
    }
    expect(tables.peek.users()).toHaveLength(0)
  })
})

describe('POST /api/client/auth/login', () => {
  async function seed() {
    tables.seedClient({ id: 'client_1', email: 'jordan@example.com', name: 'Jordan Ashworth', passwordHash: await hashPassword(VALID.password) })
  }

  it('logs in with correct credentials (email case-insensitive) and sets the session cookie', async () => {
    await seed()
    const res = await request(createApp()).post('/api/client/auth/login').send({ email: 'JORDAN@example.com', password: VALID.password })

    expect(res.status).toBe(200)
    expect(res.body.data.client).toMatchObject({ id: 'client_1', email: 'jordan@example.com' })
    expect(cookiesOf(res).find((c) => c.startsWith('velnora_client_session='))).toMatch(/HttpOnly/i)
  })

  it('rejects a wrong password with a generic 401 and sets no cookie', async () => {
    await seed()
    const res = await request(createApp()).post('/api/client/auth/login').send({ email: 'jordan@example.com', password: 'Wrong-Password-1' })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid email or password.')
    expect(cookiesOf(res).find((c) => c.startsWith('velnora_client_session=') && !/Expires=Thu, 01 Jan 1970/.test(c))).toBeUndefined()
  })

  it('gives the IDENTICAL response for an unknown email as for a wrong password (no account enumeration)', async () => {
    await seed()
    const wrongPassword = await request(createApp()).post('/api/client/auth/login').send({ email: 'jordan@example.com', password: 'Wrong-Password-1' })
    const unknownEmail = await request(createApp()).post('/api/client/auth/login').send({ email: 'nobody@example.com', password: 'Wrong-Password-1' })

    expect(unknownEmail.status).toBe(wrongPassword.status)
    expect(unknownEmail.body).toEqual(wrongPassword.body)
  })

  it('rejects malformed login bodies with 400 (including extra fields)', async () => {
    const app = createApp()
    for (const body of [{}, { email: 'jordan@example.com' }, { email: 'bad', password: 'x' }, { email: 'a@b.co', password: 'x', role: 'ADMIN' }]) {
      const res = await request(app).post('/api/client/auth/login').send(body)
      expect(res.status).toBe(400)
    }
  })

  it('never leaks database details when the database fails', async () => {
    tables.user.findUnique.mockRejectedValueOnce(new Error('password authentication failed for user "velnora_app"'))
    const res = await request(createApp()).post('/api/client/auth/login').send({ email: 'jordan@example.com', password: VALID.password })

    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
  })
})

describe('session and logout', () => {
  it('requires a session: GET /api/client/session is 401 without one', async () => {
    const res = await request(createApp()).get('/api/client/session')
    expect(res.status).toBe(401)
  })

  it('rejects a forged or unknown session cookie', async () => {
    const res = await request(createApp()).get('/api/client/session').set('Cookie', 'velnora_client_session=forged-token-value')
    expect(res.status).toBe(401)
  })

  it('rejects an expired session', async () => {
    const agent = request.agent(createApp())
    await agent.post('/api/client/auth/register').send(VALID)
    tables.peek.sessions()[0]!.expiresAt = new Date(Date.now() - 1000)

    const res = await agent.get('/api/client/session')
    expect(res.status).toBe(401)
  })

  it('logout destroys the server-side session: the old cookie stops working even if replayed', async () => {
    const app = createApp()
    const registered = await request(app).post('/api/client/auth/register').send(VALID)
    const cookie = cookiesOf(registered).find((c) => c.startsWith('velnora_client_session='))!.split(';')[0]!

    expect((await request(app).get('/api/client/session').set('Cookie', cookie)).status).toBe(200)
    const out = await request(app).post('/api/client/auth/logout').set('Cookie', cookie)
    expect(out.status).toBe(200)
    expect(tables.peek.sessions()).toHaveLength(0)
    expect((await request(app).get('/api/client/session').set('Cookie', cookie)).status).toBe(401)
  })

  it('logout is idempotent and never errors without a session', async () => {
    const res = await request(createApp()).post('/api/client/auth/logout')
    expect(res.status).toBe(200)
  })
})

describe('client and admin identities are separate', () => {
  it('a client session cookie never authorizes an admin route', async () => {
    const agent = request.agent(createApp())
    await agent.post('/api/client/auth/register').send(VALID)

    for (const path of ['/api/admin/overview', '/api/admin/projects', '/api/admin/client-leads', '/api/admin/agents/customer-handler/config']) {
      expect((await agent.get(path)).status).toBe(401)
    }
    expect((await agent.get('/api/auth/admin/me')).status).toBe(401)
  })

  it('an admin session cookie never authorizes a client route', async () => {
    tables.seedAdminUser({ id: 'admin_1', email: 'owner@velnora.com', passwordHash: await hashPassword('Admin-Password-123') })
    const agent = request.agent(createApp())
    await agent.post('/api/auth/admin/login').send({ email: 'owner@velnora.com', password: 'Admin-Password-123' })

    expect((await agent.get('/api/auth/admin/me')).status).toBe(200)
    expect((await agent.get('/api/client/session')).status).toBe(401)
    expect((await agent.get('/api/client/projects')).status).toBe(401)
  })

  it('the legacy shared X-Admin-Token is not a client credential either', async () => {
    const res = await request(createApp()).get('/api/client/projects').set('X-Admin-Token', 'anything')
    expect(res.status).toBe(401)
  })
})
