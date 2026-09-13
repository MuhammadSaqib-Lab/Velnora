import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn() },
}))

const { createApp } = await import('../src/app.js')

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const app = createApp()
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('rejects a request from an origin that is not allow-listed', async () => {
    const app = createApp()
    const res = await request(app).get('/api/health').set('Origin', 'https://evil-site.example.com')

    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ success: false })
  })
})
