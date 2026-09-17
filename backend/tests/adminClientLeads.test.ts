import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'

// See adminOverview.test.ts — generous on purpose so the many logins
// across this file's tests never trip the login rate limiter itself.
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    ...createAdminAuthTables(),
    qualifiedLead: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    aIConversation: {
      findUnique: vi.fn(),
    },
  },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

const TEST_EMAIL = 'owner@velnora.com'
const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-9'

// requireAdminSession() (admin.routes.ts) requires a real logged-in
// AdminUser session — see adminOverview.test.ts for the same reasoning.
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

function qualifiedLeadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ql_1',
    conversationId: 'conv_1',
    name: 'Jordan Ashworth',
    email: 'jordan@example.com',
    phone: null,
    company: 'Acme Co',
    website: null,
    service: 'new-website',
    requirements: 'Needs a new marketing site.',
    budget: null,
    timeline: null,
    intent: 'HIGH',
    status: 'NEW',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('GET /api/admin/client-leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a real logged-in admin session', async () => {
    const app = createApp()
    const res = await request(app).get('/api/admin/client-leads')
    expect(res.status).toBe(401)
  })

  it('lists client leads with pagination metadata', async () => {
    vi.mocked(prisma.qualifiedLead.findMany).mockResolvedValue([qualifiedLeadRow()] as never)
    vi.mocked(prisma.qualifiedLead.count).mockResolvedValue(1)

    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/client-leads')

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.leads).toHaveLength(1)
  })

  it('rejects an invalid status filter with 400', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/client-leads?status=NOT_REAL')
    expect(res.status).toBe(400)
  })

  it('supports searching by name/email/company', async () => {
    vi.mocked(prisma.qualifiedLead.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.qualifiedLead.count).mockResolvedValue(0)

    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/client-leads?search=acme')

    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.qualifiedLead.findMany).mock.calls[0]?.[0]
    expect(call?.where?.OR).toBeDefined()
  })

  it('returns a safe 500 when listing fails at the database, never leaking the underlying error', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)

    vi.mocked(prisma.qualifiedLead.findMany).mockRejectedValue(
      new Error('Authentication failed against database server, the provided database credentials for `velnora_app` are not valid.'),
    )
    vi.mocked(prisma.qualifiedLead.count).mockResolvedValue(0)

    const res = await agent.get('/api/admin/client-leads')

    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
  })
})

describe('GET /api/admin/client-leads/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a lead by id', async () => {
    vi.mocked(prisma.qualifiedLead.findUnique).mockResolvedValue(qualifiedLeadRow() as never)
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/client-leads/ql_1')
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('ql_1')
  })

  it('returns 404 for an unknown lead id', async () => {
    vi.mocked(prisma.qualifiedLead.findUnique).mockResolvedValue(null)
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/client-leads/does-not-exist')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/admin/client-leads/:id/conversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the conversation transcript only via this explicit endpoint', async () => {
    vi.mocked(prisma.qualifiedLead.findUnique).mockResolvedValue(qualifiedLeadRow() as never)
    vi.mocked(prisma.aIConversation.findUnique).mockResolvedValue({
      id: 'conv_1',
      sessionId: 'sess_1',
      status: 'QUALIFIED',
      messages: [
        { id: 'm1', role: 'USER', content: 'Hi, I need a website', createdAt: new Date() },
        { id: 'm2', role: 'ASSISTANT', content: 'Sure, tell me more', createdAt: new Date() },
      ],
    } as never)

    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/client-leads/ql_1/conversation')

    expect(res.status).toBe(200)
    expect(res.body.data.messages).toHaveLength(2)
  })

  it('returns 404 when the lead does not exist (never leaks another lead\'s conversation, IDOR-safe)', async () => {
    vi.mocked(prisma.qualifiedLead.findUnique).mockResolvedValue(null)
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/client-leads/does-not-exist/conversation')
    expect(res.status).toBe(404)
    expect(prisma.aIConversation.findUnique).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/client-leads/:id/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates status to a valid SubmissionStatus value', async () => {
    vi.mocked(prisma.qualifiedLead.findUnique).mockResolvedValue(qualifiedLeadRow() as never)
    vi.mocked(prisma.qualifiedLead.update).mockResolvedValue(qualifiedLeadRow({ status: 'RESOLVED' }) as never)

    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.patch('/api/admin/client-leads/ql_1/status').send({ status: 'RESOLVED' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('RESOLVED')
  })

  it('rejects an invalid status value with 400', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.patch('/api/admin/client-leads/ql_1/status').send({ status: 'MADE_UP_STATUS' })
    expect(res.status).toBe(400)
    expect(prisma.qualifiedLead.update).not.toHaveBeenCalled()
  })

  it('rejects a malicious extra field (strict mode) with 400 — defense against mass-assignment', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent
      .patch('/api/admin/client-leads/ql_1/status')
      .send({ status: 'RESOLVED', email: 'attacker@evil.example' })
    expect(res.status).toBe(400)
  })
})
