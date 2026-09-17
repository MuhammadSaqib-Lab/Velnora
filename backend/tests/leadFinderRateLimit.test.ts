import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

process.env.LEAD_FINDER_ADMIN_TOKEN = 'test-admin-token'
process.env.LEAD_FINDER_RATE_LIMIT_MAX = '2'
process.env.LEAD_FINDER_RATE_LIMIT_WINDOW_MS = '60000'

vi.mock('../src/leadFinder/providers/GooglePlacesProvider.js', () => ({
  GooglePlacesProvider: class {
    findBusinesses = vi.fn().mockResolvedValue([])
    healthCheck = vi.fn().mockResolvedValue(true)
  },
}))
vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), lead: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() } },
}))

const { createApp } = await import('../src/app.js')

describe('rate limiting on POST /api/leads/search', () => {
  it('allows requests up to the configured max, then returns 429', async () => {
    const app = createApp()
    const headers = { 'X-Admin-Token': 'test-admin-token' }
    const payload = { industry: 'dentists', location: 'Lahore' }

    const first = await request(app).post('/api/leads/search').set(headers).send(payload)
    const second = await request(app).post('/api/leads/search').set(headers).send(payload)
    const third = await request(app).post('/api/leads/search').set(headers).send(payload)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect(third.body).toMatchObject({ success: false })
  })
})
