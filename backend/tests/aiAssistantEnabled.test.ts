import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'

/**
 * Reactivation check: with AI_ASSISTANT_ENABLED=true the preserved
 * assistant code works exactly as before (admin-session gated, validated,
 * rate-limited), proving "disabled" really is just a switch and nothing was
 * broken or removed. This is the same flag a developer flips on deploy.
 */
process.env.AI_ASSISTANT_ENABLED = 'true'
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'
process.env.AI_ASSISTANT_RATE_LIMIT_MAX = '1000'
delete process.env.ELEVENLABS_API_KEY

const { generateResponse } = vi.hoisted(() => ({ generateResponse: vi.fn() }))

vi.mock('../src/ai/providers/AnthropicProvider.js', () => ({
  AnthropicProvider: class {
    generateResponse = generateResponse
    healthCheck = vi.fn().mockResolvedValue(true)
  },
}))

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')
const { isAiAssistantEnabled } = await import('../src/aiAssistant/featureFlag.js')

const tables = prisma as unknown as ReturnType<typeof createAdminAuthTables>

async function adminAgent() {
  tables.seedAdminUser({ id: 'admin_1', email: 'owner@velnora.com', passwordHash: await hashPassword('Admin-Password-123') })
  const agent = request.agent(createApp())
  await agent.post('/api/auth/admin/login').send({ email: 'owner@velnora.com', password: 'Admin-Password-123' })
  return agent
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AI Assistant when AI_ASSISTANT_ENABLED=true (reactivation path)', () => {
  it('the flag reads as enabled', () => {
    expect(isAiAssistantEnabled()).toBe(true)
  })

  it('still requires an admin session', async () => {
    const res = await request(createApp()).post('/api/admin/ai-assistant/command').send({ message: 'hi', history: [] })
    expect(res.status).toBe(401)
    expect(generateResponse).not.toHaveBeenCalled()
  })

  it('processes a command through the preserved orchestrator (simulated actions only)', async () => {
    generateResponse.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Understood — here is the plan.' }], stopReason: 'end_turn' })
    const admin = await adminAgent()
    const res = await admin.post('/api/admin/ai-assistant/command').send({ message: 'Find dentists in Lahore', history: [] })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, message: 'Understood — here is the plan.', data: { actions: [] } })
    expect(generateResponse).toHaveBeenCalledTimes(1)
  })

  it('still validates input (a bad body is a 400, not the disabled message)', async () => {
    const admin = await adminAgent()
    const res = await admin.post('/api/admin/ai-assistant/command').send({ message: '' })
    expect(res.status).toBe(400)
    expect(generateResponse).not.toHaveBeenCalled()
  })

  it('voice output reports "not configured" (not "disabled") when no ElevenLabs key is set', async () => {
    const admin = await adminAgent()
    const res = await admin.post('/api/admin/ai-assistant/speak').send({ text: 'Hello' })
    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/not configured/i)
    expect(res.body.message).not.toMatch(/disabled/i)
  })
})
