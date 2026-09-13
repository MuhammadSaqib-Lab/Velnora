import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 and databaseConnected: true when the database responds', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }])

    const app = createApp()
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, data: { databaseConnected: true } })
  })

  it('returns 503 and databaseConnected: false when the database is unreachable', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('connection refused'))

    const app = createApp()
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ success: true, data: { databaseConnected: false } })
  })
})
