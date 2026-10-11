import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'
import { createAgentConfigTables } from './helpers/agentConfigTables.js'
import { createMarketingTables } from './helpers/marketingTables.js'

// Small, deterministic limit set before env.ts loads (same pattern as the other rate-limit tests).
process.env.MARKETING_TASK_RATE_LIMIT_MAX = '2'
process.env.MARKETING_TASK_RATE_LIMIT_WINDOW_MS = '60000'
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables(), ...createAgentConfigTables(), ...createMarketingTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

describe('rate limiting on Digital Marketing tasks', () => {
  it('lets task-starting routes through up to the configured max, then returns 429 — reads are not limited', async () => {
    ;(prisma as unknown as ReturnType<typeof createAdminAuthTables>).seedAdminUser({
      id: 'admin_1',
      email: 'owner@velnora.com',
      passwordHash: await hashPassword('a-strong-test-password-123'),
    })
    const agent = request.agent(createApp())
    await agent.post('/api/auth/admin/login').send({ email: 'owner@velnora.com', password: 'a-strong-test-password-123' })

    // Rejected-at-validation requests still count: the limiter runs before any work is done.
    const start = () => agent.post('/api/admin/marketing/seo/audits').send({ url: 'http://localhost' })
    const first = await start()
    const second = await start()
    const third = await start()
    const read = await agent.get('/api/admin/marketing/tasks')
    const overview = await agent.get('/api/admin/marketing/overview')

    expect(first.status).toBe(400)
    expect(second.status).toBe(400)
    expect(third.status).toBe(429)
    expect(third.body).toMatchObject({ success: false })
    expect(read.status).toBe(200)
    expect(overview.status).toBe(200)
  })
})
