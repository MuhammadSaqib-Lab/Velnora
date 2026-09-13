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
})
