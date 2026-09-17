import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'

// This file logs in once per test to exercise the real admin-session
// gate — generous on purpose so it never trips the login rate limiter
// itself (that has its own dedicated coverage in adminLoginRateLimit.test.ts).
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    ...createAdminAuthTables(),
    lead: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    qualifiedLead: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    aIConversation: {
      findMany: vi.fn(),
    },
  },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

const TEST_EMAIL = 'owner@velnora.com'
const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-9'

/**
 * requireAdminSession() (admin.routes.ts) requires a real logged-in
 * AdminUser session, not the legacy X-Admin-Token header (that's only
 * still accepted on /api/leads/*, see requireAdminAccess.ts). Every test
 * below authenticates the same way an actual browser would: log in once
 * via the real /api/auth/admin/login flow, then reuse the resulting
 * session cookie via a supertest agent.
 */
async function loggedInAgent(app: ReturnType<typeof createApp>) {
  ;(prisma as unknown as ReturnType<typeof createAdminAuthTables>).seedAdminUser({
    id: 'admin_test_1',
    email: TEST_EMAIL,
    passwordHash: await hashPassword(TEST_PASSWORD),
  })
  const agent = request.agent(app)
  await agent.post('/api/auth/admin/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD })
  return agent
}

function stubHappyPath() {
  vi.mocked(prisma.lead.count).mockResolvedValue(12)
  vi.mocked(prisma.lead.groupBy).mockImplementation(async ({ by }: { by: string[] }) => {
    if (by[0] === 'status') {
      return [
        { status: 'NEW', _count: { _all: 3 } },
        { status: 'RESEARCHED', _count: { _all: 4 } },
        { status: 'EMAIL_DRAFTED', _count: { _all: 2 } },
        { status: 'CONVERTED', _count: { _all: 1 } },
      ] as never
    }
    return [
      { priority: 'EXCELLENT', _count: { _all: 2 } },
      { priority: 'STRONG', _count: { _all: 3 } },
      { priority: 'LOW', _count: { _all: 5 } },
    ] as never
  })
  vi.mocked(prisma.qualifiedLead.count).mockResolvedValue(6)
  vi.mocked(prisma.qualifiedLead.groupBy).mockImplementation(async ({ by }: { by: string[] }) => {
    if (by[0] === 'status') {
      return [
        { status: 'NEW', _count: { _all: 4 } },
        { status: 'RESOLVED', _count: { _all: 2 } },
      ] as never
    }
    return [
      { intent: 'HIGH', _count: { _all: 2 } },
      { intent: 'LOW', _count: { _all: 4 } },
    ] as never
  })
  vi.mocked(prisma.lead.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.qualifiedLead.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.aIConversation.findMany).mockResolvedValue([] as never)
}

describe('GET /api/admin/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a real logged-in admin session', async () => {
    stubHappyPath()
    const app = createApp()
    const res = await request(app).get('/api/admin/overview')
    expect(res.status).toBe(401)
  })

  it('returns real aggregated counts, never fabricated data', async () => {
    stubHappyPath()
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/overview')

    expect(res.status).toBe(200)
    expect(res.body.data.totalLeads).toBe(18) // 12 + 6, both from real counts
    expect(res.body.data.leadFinder).toMatchObject({
      total: 12,
      newCount: 3,
      researchedCount: 4,
      emailDraftedCount: 2,
      convertedCount: 1,
      highPriorityCount: 5, // EXCELLENT(2) + STRONG(3)
    })
    expect(res.body.data.clientAgent).toMatchObject({
      total: 6,
      newCount: 4,
      resolvedCount: 2,
      highIntentCount: 2,
    })
    expect(res.body.data.recentActivity).toHaveProperty('recentLeads')
    expect(res.body.data.recentActivity).toHaveProperty('recentConversations')
    expect(res.body.data.recentActivity).toHaveProperty('recentDiscoveries')
    expect(res.body.data.recentActivity).toHaveProperty('recentOutreach')
  })

  it('returns a safe 500 (a clear error state), never zeros disguised as real data, when the database fails', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)

    vi.mocked(prisma.lead.count).mockRejectedValue(
      new Error('Authentication failed against database server, the provided database credentials for `velnora_app` are not valid.'),
    )
    vi.mocked(prisma.lead.groupBy).mockResolvedValue([] as never)
    vi.mocked(prisma.qualifiedLead.count).mockResolvedValue(0)
    vi.mocked(prisma.qualifiedLead.groupBy).mockResolvedValue([] as never)
    vi.mocked(prisma.lead.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.qualifiedLead.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.aIConversation.findMany).mockResolvedValue([] as never)

    const res = await agent.get('/api/admin/overview')

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
    expect(JSON.stringify(res.body)).not.toContain('credentials')
  })
})
