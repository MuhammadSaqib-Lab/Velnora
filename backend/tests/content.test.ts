import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn() },
}))

const { createApp } = await import('../src/app.js')

describe('GET /api/services', () => {
  it('returns the six core services', async () => {
    const app = createApp()
    const res = await request(app).get('/api/services')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveLength(6)
    expect(res.body.data[0]).toHaveProperty('title')
    expect(res.body.data[0]).toHaveProperty('slug')
  })
})

describe('GET /api/projects', () => {
  it('returns the concept portfolio projects', async () => {
    const app = createApp()
    const res = await request(app).get('/api/projects')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data[0]).toHaveProperty('name')
  })
})

describe('unknown routes', () => {
  it('returns a 404 with a clean JSON error, not an HTML error page', async () => {
    const app = createApp()
    const res = await request(app).get('/api/does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false })
  })
})
