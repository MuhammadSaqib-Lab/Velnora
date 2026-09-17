import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'

// Same pattern as leadFinderRateLimit.test.ts: a dedicated file with its
// own low, real limit, imported once, so this test's own login attempts
// are the only thing exercising the limiter's counter.
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '2'
process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS = '60000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables() },
}))

const { createApp } = await import('../src/app.js')

describe('rate limiting on POST /api/auth/admin/login', () => {
  it('allows requests up to the configured max, then returns 429 — the primary brute-force defense', async () => {
    const app = createApp()
    const payload = { email: 'owner@velnora.com', password: 'wrong-password' }

    const first = await request(app).post('/api/auth/admin/login').send(payload)
    const second = await request(app).post('/api/auth/admin/login').send(payload)
    const third = await request(app).post('/api/auth/admin/login').send(payload)

    // No account exists at all in this test, so every attempt is a 401 —
    // the rate limiter counts requests regardless of outcome, which is
    // exactly the point: it caps guesses, not just successful ones.
    expect(first.status).toBe(401)
    expect(second.status).toBe(401)
    expect(third.status).toBe(429)
    expect(third.body).toMatchObject({ success: false })
  })
})
