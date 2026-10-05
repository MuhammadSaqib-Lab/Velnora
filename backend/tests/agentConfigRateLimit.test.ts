import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'
import { createAgentConfigTables } from './helpers/agentConfigTables.js'

// Small, deterministic limit set before env.ts loads (same pattern as the other rate-limit tests).
process.env.AGENT_CONFIG_RATE_LIMIT_MAX = '2'
process.env.AGENT_CONFIG_RATE_LIMIT_WINDOW_MS = '60000'
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables(), ...createAgentConfigTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

describe('rate limiting on agent configuration writes', () => {
  it('allows writes up to the configured max, then returns 429 — reads are not limited', async () => {
    ;(prisma as unknown as ReturnType<typeof createAdminAuthTables>).seedAdminUser({
      id: 'admin_1',
      email: 'owner@velnora.com',
      passwordHash: await hashPassword('a-strong-test-password-123'),
    })
    const agent = request.agent(createApp())
    await agent.post('/api/auth/admin/login').send({ email: 'owner@velnora.com', password: 'a-strong-test-password-123' })

    const body = (expectedVersion: number) => ({
      rules: `edit ${expectedVersion}`,
      instructions: 'You are a helpful agent for Velnora.',
      enabled: true,
      expectedVersion,
    })
    const first = await agent.patch('/api/admin/agents/customer-handler/config').send(body(1))
    const second = await agent.patch('/api/admin/agents/customer-handler/config').send(body(2))
    const third = await agent.patch('/api/admin/agents/customer-handler/config').send(body(3))
    const read = await agent.get('/api/admin/agents/customer-handler/config')

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect(third.body).toMatchObject({ success: false })
    expect(read.status).toBe(200)
  })
})
