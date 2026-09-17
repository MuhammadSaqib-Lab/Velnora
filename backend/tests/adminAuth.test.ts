import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'

// Generous on purpose — this file logs in many times across many tests
// that aren't about rate limiting itself. The dedicated brute-force
// coverage lives in adminLoginRateLimit.test.ts, in its own file with a
// low, real limit, following the same pattern as
// leadFinderRateLimit.test.ts.
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

const TEST_EMAIL = 'owner@velnora.com'
const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-9'

async function seedTestAdmin() {
  const passwordHash = await hashPassword(TEST_PASSWORD)
  // Real bcrypt hash format, never the plaintext password itself.
  expect(passwordHash).toMatch(/^\$2[aby]\$/)
  expect(passwordHash).not.toContain(TEST_PASSWORD)
  ;(prisma as unknown as ReturnType<typeof createAdminAuthTables>).seedAdminUser({
    id: 'admin_test_1',
    email: TEST_EMAIL,
    passwordHash,
  })
}

describe('POST /api/auth/admin/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs in with correct credentials and sets a secure, httpOnly session cookie', async () => {
    await seedTestAdmin()
    const app = createApp()

    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.admin).toEqual({ id: 'admin_test_1', email: TEST_EMAIL })

    const setCookie = res.headers['set-cookie']
    const cookies: string[] = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
    const sessionCookie = cookies.find((c) => c.startsWith('velnora_admin_session='))
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toMatch(/HttpOnly/i)
    expect(sessionCookie).toMatch(/SameSite=Lax/i)
  })

  it('never returns the password or password hash anywhere in the response', async () => {
    await seedTestAdmin()
    const app = createApp()

    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })

    const body = JSON.stringify(res.body)
    expect(body).not.toContain(TEST_PASSWORD)
    expect(body.toLowerCase()).not.toContain('passwordhash')
    expect(body).not.toMatch(/\$2[aby]\$/)
  })

  it('rejects an unknown email with a generic 401, never revealing the account does not exist', async () => {
    await seedTestAdmin()
    const app = createApp()

    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'nobody@velnora.com', password: TEST_PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid email or password.')
  })

  it('rejects the correct email with the wrong password using the identical generic 401 message', async () => {
    await seedTestAdmin()
    const app = createApp()

    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: TEST_EMAIL, password: 'totally-wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid email or password.')
  })

  it('rejects missing credentials with 400 before ever touching the database', async () => {
    await seedTestAdmin()
    const app = createApp()

    const res = await request(app).post('/api/auth/admin/login').send({})

    expect(res.status).toBe(400)
    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a malformed email with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'not-an-email', password: TEST_PASSWORD })
    expect(res.status).toBe(400)
  })

  it('rejects an unexpected extra field (strict mode) with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, role: 'SUPERADMIN' })
    expect(res.status).toBe(400)
  })

  it('returns a safe 500 when the database is unreachable, never leaking the underlying error', async () => {
    vi.mocked(prisma.adminUser.findUnique).mockRejectedValueOnce(
      new Error('Authentication failed against database server, the provided database credentials for `velnora_app` are not valid.'),
    )
    const app = createApp()
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
    expect(JSON.stringify(res.body)).not.toContain('credentials')
  })
})

describe('GET /api/auth/admin/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    const app = createApp()
    const res = await request(app).get('/api/auth/admin/me')
    expect(res.status).toBe(401)
  })

  it('returns the admin identity (never the password hash) once logged in', async () => {
    await seedTestAdmin()
    const agent = request.agent(createApp())

    await agent.post('/api/auth/admin/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD })
    const res = await agent.get('/api/auth/admin/me')

    expect(res.status).toBe(200)
    expect(res.body.data.admin).toEqual({ id: 'admin_test_1', email: TEST_EMAIL })
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('passwordhash')
  })

  it('rejects a garbage/forged session cookie as 401', async () => {
    const app = createApp()
    const res = await request(app).get('/api/auth/admin/me').set('Cookie', 'velnora_admin_session=not-a-real-token')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/admin/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates the session so it can never be reused (session invalidation)', async () => {
    await seedTestAdmin()
    const agent = request.agent(createApp())

    await agent.post('/api/auth/admin/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD })
    expect((await agent.get('/api/auth/admin/me')).status).toBe(200)

    const logoutRes = await agent.post('/api/auth/admin/logout')
    expect(logoutRes.status).toBe(200)

    const afterLogout = await agent.get('/api/auth/admin/me')
    expect(afterLogout.status).toBe(401)
  })

  it('is idempotent — logging out with no session at all still succeeds', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/admin/logout')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('/api/admin/* authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an unauthenticated request with 401', async () => {
    const app = createApp()
    const res = await request(app).get('/api/admin/overview')
    expect(res.status).toBe(401)
  })

  it('rejects the legacy X-Admin-Token header alone — the dashboard API requires a real session', async () => {
    process.env.LEAD_FINDER_ADMIN_TOKEN = 'legacy-token'
    const app = createApp()
    const res = await request(app).get('/api/admin/overview').set('X-Admin-Token', 'legacy-token')
    expect(res.status).toBe(401)
    delete process.env.LEAD_FINDER_ADMIN_TOKEN
  })

  it('allows an authenticated admin session through to a protected /api/admin/* route', async () => {
    await seedTestAdmin()
    const agent = request.agent(createApp())
    await agent.post('/api/auth/admin/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD })

    // adminOverview.test.ts covers the real data shape; this only proves
    // the session gate itself lets an authenticated caller through
    // (a downstream 500 from the un-mocked lead/qualifiedLead tables
    // here is expected and fine, it's still not a 401).
    const res = await agent.get('/api/admin/overview')
    expect(res.status).not.toBe(401)
  })
})
