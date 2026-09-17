import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    ...createAdminAuthTables(),
    lead: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  },
}))
vi.mock('../src/leadFinder/providers/GooglePlacesProvider.js', () => ({
  GooglePlacesProvider: class {
    findBusinesses = vi.fn().mockResolvedValue([])
    healthCheck = vi.fn().mockResolvedValue(false)
  },
}))

describe('/api/leads/* admin gate', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('rejects with 401 when LEAD_FINDER_ADMIN_TOKEN is unset and there is no admin session — never an open endpoint by accident', async () => {
    // Prior to the Admin Dashboard login system, an unset token meant a
    // blanket 503 (the only auth mechanism was unconfigured). Now that a
    // valid admin session is an equally legitimate way in
    // (requireAdminAccess.ts), "the legacy token isn't set" no longer
    // means "this endpoint is unusable" — it's just one of two credentials
    // not being presented, so this is a normal 401, not a 503.
    delete process.env.LEAD_FINDER_ADMIN_TOKEN
    const { createApp } = await import('../src/app.js')
    const app = createApp()

    const res = await request(app).get('/api/leads')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('rejects a request with no token as 401 when a token IS configured', async () => {
    process.env.LEAD_FINDER_ADMIN_TOKEN = 'correct-token'
    const { createApp } = await import('../src/app.js')
    const app = createApp()

    const res = await request(app).get('/api/leads')
    expect(res.status).toBe(401)
  })

  it('rejects a request with the wrong token as 401', async () => {
    process.env.LEAD_FINDER_ADMIN_TOKEN = 'correct-token'
    const { createApp } = await import('../src/app.js')
    const app = createApp()

    const res = await request(app).get('/api/leads').set('X-Admin-Token', 'wrong-token')
    expect(res.status).toBe(401)
  })

  it('allows a request with the correct token through to the route', async () => {
    process.env.LEAD_FINDER_ADMIN_TOKEN = 'correct-token'
    const { createApp } = await import('../src/app.js')
    const app = createApp()

    const res = await request(app).get('/api/leads').set('X-Admin-Token', 'correct-token')
    expect(res.status).toBe(200)
  })

  it('never gates the Gmail OAuth callback behind the admin token (Google\'s redirect cannot send it)', async () => {
    process.env.LEAD_FINDER_ADMIN_TOKEN = 'correct-token'
    const { createApp } = await import('../src/app.js')
    const app = createApp()

    // No X-Admin-Token header at all, simulating Google's browser redirect.
    const res = await request(app).get('/api/leads/gmail/oauth-callback')
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(503)
  })

  it('also allows a valid Admin Dashboard login session through, with no token configured at all', async () => {
    delete process.env.LEAD_FINDER_ADMIN_TOKEN
    const { createApp } = await import('../src/app.js')
    const { prisma } = await import('../src/database/prisma.js')
    const { hashPassword } = await import('../src/utils/passwordHash.js')

    ;(prisma as unknown as ReturnType<typeof createAdminAuthTables>).seedAdminUser({
      id: 'admin_1',
      email: 'owner@velnora.com',
      passwordHash: await hashPassword('a-strong-test-password-123'),
    })

    const app = createApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/admin/login').send({ email: 'owner@velnora.com', password: 'a-strong-test-password-123' })

    const res = await agent.get('/api/leads')
    expect(res.status).toBe(200)
  })
})
