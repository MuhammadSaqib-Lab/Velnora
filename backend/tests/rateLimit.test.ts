import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

// Set a small, deterministic limit before anything imports env.ts, so
// this test doesn't need to fire 5+ real requests to prove the
// middleware works.
process.env.CONTACT_RATE_LIMIT_MAX = '2'
process.env.CONTACT_RATE_LIMIT_WINDOW_MS = '60000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    contactSubmission: { create: vi.fn().mockResolvedValue({ id: 'x', createdAt: new Date() }) },
    review: { create: vi.fn().mockResolvedValue({ id: 'rev_x', status: 'PENDING', createdAt: new Date() }) },
  },
}))

const { createApp } = await import('../src/app.js')

const validPayload = {
  name: 'Rate Limit Tester',
  email: 'rate-limit@example.com',
  message: 'Testing that the rate limiter actually engages after the configured max.',
}

describe('rate limiting on POST /api/contact', () => {
  it('allows requests up to the configured max, then returns 429', async () => {
    const app = createApp()

    const first = await request(app).post('/api/contact').send(validPayload)
    const second = await request(app).post('/api/contact').send(validPayload)
    const third = await request(app).post('/api/contact').send(validPayload)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(third.status).toBe(429)
    expect(third.body).toMatchObject({ success: false })
  })

  it('shares its bucket with POST /api/reviews — both are the same public-form abuse profile', async () => {
    const app = createApp()
    const reviewPayload = { name: 'Rate Limit Tester', rating: 5, reviewText: 'Testing that reviews share the contact form rate limit bucket.' }

    await request(app).post('/api/contact').send(validPayload)
    await request(app).post('/api/contact').send(validPayload)
    // The bucket (max 2) is now exhausted by /api/contact alone — a
    // request to the *different* /api/reviews route from the same caller
    // should still be blocked, proving they share one limiter instance.
    const res = await request(app).post('/api/reviews').send(reviewPayload)

    expect(res.status).toBe(429)
  })
})
