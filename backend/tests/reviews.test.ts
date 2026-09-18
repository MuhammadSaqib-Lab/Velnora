import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// POST /api/reviews shares formSubmissionRateLimiter with /api/contact and
// /api/project-inquiry (see reviews.routes.ts) — generous here so this
// file's many submission tests never trip it. The limiter's own 429
// behavior (and that /api/reviews shares its bucket) is covered in
// rateLimit.test.ts, mirroring the pattern used for the admin login
// limiter elsewhere in this suite.
process.env.CONTACT_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    review: {
      create: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
  },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev_1',
    name: 'Jordan Ashworth',
    email: 'jordan@example.com',
    rating: 5,
    reviewText: 'Velnora rebuilt our site and it actually converts now. Great communication throughout.',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('POST /api/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a valid review and stores it as PENDING (never auto-approved)', async () => {
    vi.mocked(prisma.review.create).mockResolvedValue({ id: 'rev_1', status: 'PENDING', createdAt: new Date() } as never)

    const app = createApp()
    const res = await request(app).post('/api/reviews').send({
      name: 'Jordan Ashworth',
      email: 'jordan@example.com',
      rating: 5,
      reviewText: 'Velnora rebuilt our site and it actually converts now.',
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('PENDING')
    const createArgs = vi.mocked(prisma.review.create).mock.calls[0]?.[0]
    expect(createArgs?.data).not.toHaveProperty('status') // never client-settable
  })

  it('accepts a submission with no email (optional field)', async () => {
    vi.mocked(prisma.review.create).mockResolvedValue({ id: 'rev_2', status: 'PENDING', createdAt: new Date() } as never)
    const app = createApp()
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Sam Rivera', rating: 4, reviewText: 'Good experience overall, would work with them again.' })
    expect(res.status).toBe(201)
  })

  it('rejects a missing name with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/reviews')
      .send({ rating: 5, reviewText: 'Great service, highly recommend to anyone.' })
    expect(res.status).toBe(400)
    expect(prisma.review.create).not.toHaveBeenCalled()
  })

  it('rejects a missing rating with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Jordan', reviewText: 'Great service, highly recommend to anyone.' })
    expect(res.status).toBe(400)
  })

  it.each([0, 6, -1, 2.5, 100])('rejects an invalid rating value %s with 400', async (rating) => {
    const app = createApp()
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Jordan', rating, reviewText: 'Great service, highly recommend to anyone.' })
    expect(res.status).toBe(400)
    expect(prisma.review.create).not.toHaveBeenCalled()
  })

  it('rejects a missing review text with 400', async () => {
    const app = createApp()
    const res = await request(app).post('/api/reviews').send({ name: 'Jordan', rating: 5 })
    expect(res.status).toBe(400)
  })

  it('rejects review text under the minimum length with 400', async () => {
    const app = createApp()
    const res = await request(app).post('/api/reviews').send({ name: 'Jordan', rating: 5, reviewText: 'Too short' })
    expect(res.status).toBe(400)
  })

  it('rejects excessively long review text with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Jordan', rating: 5, reviewText: 'x'.repeat(2001) })
    expect(res.status).toBe(400)
    expect(prisma.review.create).not.toHaveBeenCalled()
  })

  it('rejects a malformed email with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Jordan', email: 'not-an-email', rating: 5, reviewText: 'Great service, highly recommend it.' })
    expect(res.status).toBe(400)
  })

  it('rejects an unexpected extra field (strict mode) — mass-assignment defense', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Jordan', rating: 5, reviewText: 'Great service, highly recommend it.', status: 'APPROVED' })
    expect(res.status).toBe(400)
    expect(prisma.review.create).not.toHaveBeenCalled()
  })

  it('accepts HTML/script-like content as inert text — XSS defense is JSX auto-escaping on render, not input filtering (same posture as every other form in this app)', async () => {
    vi.mocked(prisma.review.create).mockResolvedValue({ id: 'rev_3', status: 'PENDING', createdAt: new Date() } as never)
    const app = createApp()
    const maliciousText = '<script>alert(document.cookie)</script> Also a totally normal review of the service.'
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Jordan', rating: 5, reviewText: maliciousText })

    expect(res.status).toBe(201)
    const createArgs = vi.mocked(prisma.review.create).mock.calls[0]?.[0]
    // Stored verbatim, not stripped/mangled — proves no naive escaping bug
    // that could corrupt legitimate reviews mentioning "<" or "&".
    expect(createArgs?.data.reviewText).toBe(maliciousText)
  })

  it('returns a safe 500 when submission fails at the database, never leaking the underlying error', async () => {
    vi.mocked(prisma.review.create).mockRejectedValue(
      new Error('Authentication failed against database server, the provided database credentials for `velnora_app` are not valid.'),
    )
    const app = createApp()
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Jordan', rating: 5, reviewText: 'Great service, highly recommend it.' })

    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
  })
})

describe('GET /api/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function stubApproved(rows: ReturnType<typeof reviewRow>[]) {
    // The mock doesn't actually apply Prisma's `select` projection the way
    // a real query would — simulate that here (email excluded) so this
    // test reflects what the database would really return, not just
    // whatever object shape the mock was handed.
    const projected = rows.map(({ email: _email, ...rest }) => rest)
    vi.mocked(prisma.review.findMany).mockResolvedValue(projected as never)
    vi.mocked(prisma.review.count).mockResolvedValue(rows.length)
    const avg = rows.length > 0 ? rows.reduce((sum, r) => sum + (r.rating as number), 0) / rows.length : 0
    vi.mocked(prisma.review.aggregate).mockResolvedValue({ _avg: { rating: avg } } as never)
    const counts = new Map<number, number>()
    for (const r of rows) counts.set(r.rating as number, (counts.get(r.rating as number) ?? 0) + 1)
    vi.mocked(prisma.review.groupBy).mockResolvedValue(
      [...counts.entries()].map(([rating, count]) => ({ rating, _count: { _all: count } })) as never,
    )
  }

  it('is public — no auth required', async () => {
    stubApproved([])
    const app = createApp()
    const res = await request(app).get('/api/reviews')
    expect(res.status).toBe(200)
  })

  it('never includes email in the public response', async () => {
    stubApproved([reviewRow({ status: 'APPROVED' })])
    const app = createApp()
    const res = await request(app).get('/api/reviews')
    expect(JSON.stringify(res.body)).not.toContain('jordan@example.com')
    // Confirms the select clause itself excludes email, not just a lucky absence.
    const selectArg = vi.mocked(prisma.review.findMany).mock.calls[0]?.[0]?.select
    expect(selectArg).not.toHaveProperty('email')
  })

  it('only ever queries APPROVED rows — pending/rejected reviews are never publicly visible', async () => {
    stubApproved([])
    const app = createApp()
    await request(app).get('/api/reviews')
    const whereArg = vi.mocked(prisma.review.findMany).mock.calls[0]?.[0]?.where
    expect(whereArg).toEqual({ status: 'APPROVED' })
  })

  it('computes a real average from approved ratings — never hardcoded', async () => {
    stubApproved([reviewRow({ id: 'r1', rating: 5 }), reviewRow({ id: 'r2', rating: 4 }), reviewRow({ id: 'r3', rating: 4 })])
    const app = createApp()
    const res = await request(app).get('/api/reviews')
    expect(res.status).toBe(200)
    expect(res.body.data.summary.average).toBeCloseTo(4.3, 1)
    expect(res.body.data.summary.total).toBe(3)
  })

  it('computes an accurate rating distribution', async () => {
    stubApproved([reviewRow({ id: 'r1', rating: 5 }), reviewRow({ id: 'r2', rating: 5 }), reviewRow({ id: 'r3', rating: 3 })])
    const app = createApp()
    const res = await request(app).get('/api/reviews')
    expect(res.body.data.summary.distribution).toMatchObject({ '5': 2, '3': 1, '4': 0, '2': 0, '1': 0 })
  })

  it('returns a null average and zeroed distribution when there are no approved reviews (never fakes data)', async () => {
    stubApproved([])
    const app = createApp()
    const res = await request(app).get('/api/reviews')
    expect(res.body.data.summary.average).toBeNull()
    expect(res.body.data.summary.total).toBe(0)
    expect(res.body.data.reviews).toEqual([])
  })

  it('returns a safe 500 when loading fails at the database', async () => {
    vi.mocked(prisma.review.findMany).mockRejectedValue(
      new Error('Authentication failed against database server, the provided database credentials for `velnora_app` are not valid.'),
    )
    vi.mocked(prisma.review.aggregate).mockResolvedValue({ _avg: { rating: null } } as never)
    vi.mocked(prisma.review.groupBy).mockResolvedValue([] as never)
    vi.mocked(prisma.review.count).mockResolvedValue(0)

    const app = createApp()
    const res = await request(app).get('/api/reviews')
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
  })
})
