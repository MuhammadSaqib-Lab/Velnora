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
    review: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

const TEST_EMAIL = 'owner@velnora.com'
const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-9'

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

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev_1',
    name: 'Jordan Ashworth',
    email: 'jordan@example.com',
    rating: 5,
    reviewText: 'Velnora rebuilt our site and it actually converts now.',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('GET /api/admin/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a real logged-in admin session', async () => {
    const app = createApp()
    const res = await request(app).get('/api/admin/reviews')
    expect(res.status).toBe(401)
    expect(prisma.review.findMany).not.toHaveBeenCalled()
  })

  it('lists reviews of every status (not just approved) for the admin, with pagination metadata', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([reviewRow()] as never)
    vi.mocked(prisma.review.count).mockResolvedValue(1)

    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/reviews')

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    const whereArg = vi.mocked(prisma.review.findMany).mock.calls[0]?.[0]?.where
    expect(whereArg).toEqual({})
  })

  it('filters by status', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.review.count).mockResolvedValue(0)
    const app = createApp()
    const agent = await loggedInAgent(app)
    await agent.get('/api/admin/reviews?status=PENDING')
    const whereArg = vi.mocked(prisma.review.findMany).mock.calls[0]?.[0]?.where
    expect(whereArg).toMatchObject({ status: 'PENDING' })
  })

  it('filters by rating', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.review.count).mockResolvedValue(0)
    const app = createApp()
    const agent = await loggedInAgent(app)
    await agent.get('/api/admin/reviews?rating=5')
    const whereArg = vi.mocked(prisma.review.findMany).mock.calls[0]?.[0]?.where
    expect(whereArg).toMatchObject({ rating: 5 })
  })

  it('rejects an invalid status filter with 400', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.get('/api/admin/reviews?status=NOT_REAL')
    expect(res.status).toBe(400)
  })

  it('returns a safe 500 when listing fails at the database', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    vi.mocked(prisma.review.findMany).mockRejectedValue(
      new Error('Authentication failed against database server, the provided database credentials for `velnora_app` are not valid.'),
    )
    vi.mocked(prisma.review.count).mockResolvedValue(0)
    const res = await agent.get('/api/admin/reviews')
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
  })
})

describe('PATCH /api/admin/reviews/:id/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an unauthenticated moderation attempt with 401 — public users can never approve/reject', async () => {
    const app = createApp()
    const res = await request(app).patch('/api/admin/reviews/rev_1/status').send({ status: 'APPROVED' })
    expect(res.status).toBe(401)
    expect(prisma.review.update).not.toHaveBeenCalled()
  })

  it('approves a pending review', async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(reviewRow() as never)
    vi.mocked(prisma.review.update).mockResolvedValue(reviewRow({ status: 'APPROVED' }) as never)
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.patch('/api/admin/reviews/rev_1/status').send({ status: 'APPROVED' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('APPROVED')
  })

  it('rejects a review', async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(reviewRow() as never)
    vi.mocked(prisma.review.update).mockResolvedValue(reviewRow({ status: 'REJECTED' }) as never)
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.patch('/api/admin/reviews/rev_1/status').send({ status: 'REJECTED' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('REJECTED')
  })

  it('returns 404 for a nonexistent review id', async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null)
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.patch('/api/admin/reviews/does-not-exist/status').send({ status: 'APPROVED' })
    expect(res.status).toBe(404)
    expect(prisma.review.update).not.toHaveBeenCalled()
  })

  it('rejects an invalid status value with 400 — PENDING is not a valid moderation target', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.patch('/api/admin/reviews/rev_1/status').send({ status: 'PENDING' })
    expect(res.status).toBe(400)
    expect(prisma.review.update).not.toHaveBeenCalled()
  })

  it('rejects a malicious extra field (strict mode) with 400 — defense against mass-assignment', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent
      .patch('/api/admin/reviews/rev_1/status')
      .send({ status: 'APPROVED', rating: 1 })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/reviews/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an unauthenticated delete attempt with 401', async () => {
    const app = createApp()
    const res = await request(app).delete('/api/admin/reviews/rev_1')
    expect(res.status).toBe(401)
    expect(prisma.review.delete).not.toHaveBeenCalled()
  })

  it('deletes a review', async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(reviewRow() as never)
    vi.mocked(prisma.review.delete).mockResolvedValue(reviewRow() as never)
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.delete('/api/admin/reviews/rev_1')
    expect(res.status).toBe(200)
    expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: 'rev_1' } })
  })

  it('returns 404 when deleting a nonexistent review', async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null)
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.delete('/api/admin/reviews/does-not-exist')
    expect(res.status).toBe(404)
    expect(prisma.review.delete).not.toHaveBeenCalled()
  })
})
