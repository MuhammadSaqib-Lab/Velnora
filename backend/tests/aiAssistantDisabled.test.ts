import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'
import { createClientPortalTables } from './helpers/clientPortalTables.js'

/**
 * The AI Assistant is TEMPORARILY DISABLED (AI_ASSISTANT_ENABLED unset =
 * off). These tests pin that state: no command or voice request can reach
 * any assistant code, provider or ElevenLabs. Reactivation is covered by
 * aiAssistantEnabled.test.ts. The Customer Handler and Lead Finder suites
 * (aiChat.test.ts, agentConfig.runtime.test.ts, leads.routes.test.ts…)
 * run under this same default, so they double as the proof that those
 * agents keep working while the assistant is off.
 */
delete process.env.AI_ASSISTANT_ENABLED
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'
process.env.CLIENT_REGISTER_RATE_LIMIT_MAX = '1000'
process.env.AI_ASSISTANT_RATE_LIMIT_MAX = '1000'
process.env.LEAD_FINDER_ADMIN_TOKEN = 'legacy-token-for-test'
process.env.ELEVENLABS_API_KEY = 'eleven-SECRET-sentinel-123'
process.env.ANTHROPIC_API_KEY = 'sk-ant-SECRET-sentinel-456'

const { generateResponse, orchestratorLoaded, elevenLabsLoaded } = vi.hoisted(() => ({
  generateResponse: vi.fn(),
  orchestratorLoaded: vi.fn(),
  elevenLabsLoaded: vi.fn(),
}))

vi.mock('../src/ai/providers/AnthropicProvider.js', () => ({
  AnthropicProvider: class {
    generateResponse = generateResponse
    healthCheck = vi.fn().mockResolvedValue(true)
  },
}))

// If either assistant module is ever evaluated, these factories run — so a
// zero call count proves the disabled assistant's code was never even loaded.
vi.mock('../src/aiAssistant/orchestrator.service.js', () => {
  orchestratorLoaded()
  return { handleAssistantCommand: vi.fn() }
})
vi.mock('../src/aiAssistant/elevenLabs.service.js', () => {
  elevenLabsLoaded()
  return { synthesizeSpeech: vi.fn() }
})

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables(), ...createClientPortalTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')
const { assertAiAssistantEnabled, isAiAssistantEnabled, AI_ASSISTANT_DISABLED_MESSAGE } = await import('../src/aiAssistant/featureFlag.js')

const tables = prisma as unknown as ReturnType<typeof createAdminAuthTables> & ReturnType<typeof createClientPortalTables>

const COMMAND = { message: 'Find dentists in Lahore and draft emails', history: [] }
const SPEAK = { text: 'Hello there' }

async function adminAgent() {
  tables.seedAdminUser({ id: 'admin_1', email: 'owner@velnora.com', passwordHash: await hashPassword('Admin-Password-123') })
  const agent = request.agent(createApp())
  expect((await agent.post('/api/auth/admin/login').send({ email: 'owner@velnora.com', password: 'Admin-Password-123' })).status).toBe(200)
  return agent
}

let fetchSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.clearAllMocks()
  tables.reset()
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})

describe('AI Assistant is disabled by default', () => {
  it('the flag defaults to off and the shared check refuses', () => {
    expect(isAiAssistantEnabled()).toBe(false)
    expect(() => assertAiAssistantEnabled()).toThrow(AI_ASSISTANT_DISABLED_MESSAGE)
  })

  it('an admin gets 503 "AI Assistant is currently disabled." for commands and voice — nothing else', async () => {
    const admin = await adminAgent()
    const command = await admin.post('/api/admin/ai-assistant/command').send(COMMAND)
    const speak = await admin.post('/api/admin/ai-assistant/speak').send(SPEAK)

    for (const res of [command, speak]) {
      expect(res.status).toBe(503)
      expect(res.body).toEqual({ success: false, message: 'AI Assistant is currently disabled.' })
    }
  })

  it('never reaches the AI provider or ElevenLabs, and never loads the assistant modules', async () => {
    const admin = await adminAgent()
    await admin.post('/api/admin/ai-assistant/command').send(COMMAND)
    await admin.post('/api/admin/ai-assistant/speak').send(SPEAK)

    expect(generateResponse).not.toHaveBeenCalled()
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes('elevenlabs'))).toHaveLength(0)
    expect(orchestratorLoaded).not.toHaveBeenCalled()
    expect(elevenLabsLoaded).not.toHaveBeenCalled()
  })

  it('answers identically whatever the body is — a disabled assistant never reveals its schema (no 400s)', async () => {
    const admin = await adminAgent()
    for (const body of [{}, { message: '' }, { text: 'x'.repeat(5000) }, { history: 'nope' }, { role: 'system' }]) {
      for (const path of ['command', 'speak']) {
        const res = await admin.post(`/api/admin/ai-assistant/${path}`).send(body)
        expect(res.status, `${path} ${JSON.stringify(body).slice(0, 40)}`).toBe(503)
        expect(res.body.message).toBe('AI Assistant is currently disabled.')
      }
    }
  })

  it('leaks nothing about the implementation or any credential', async () => {
    const admin = await adminAgent()
    const raw = JSON.stringify([
      (await admin.post('/api/admin/ai-assistant/command').send(COMMAND)).body,
      (await admin.post('/api/admin/ai-assistant/speak').send(SPEAK)).body,
    ])
    for (const secret of ['eleven-SECRET-sentinel-123', 'sk-ant-SECRET-sentinel-456']) expect(raw).not.toContain(secret)
    expect(raw).not.toMatch(/elevenlabs|anthropic|orchestrator|claude|simulate/i)
  })
})

describe('no new access paths were opened while disabled', () => {
  it('unauthenticated callers still get a plain 401 (not the disabled message, nothing to probe)', async () => {
    const app = createApp()
    for (const path of ['command', 'speak']) {
      const res = await request(app).post(`/api/admin/ai-assistant/${path}`).send(path === 'command' ? COMMAND : SPEAK)
      expect(res.status).toBe(401)
      expect(res.body.message).not.toMatch(/disabled/i)
    }
    expect(generateResponse).not.toHaveBeenCalled()
  })

  it('a client-portal session is not an admin: 401, never the assistant', async () => {
    const client = request.agent(createApp())
    await client.post('/api/client/auth/register').send({
      name: 'Casey Client',
      email: 'casey@example.com',
      password: 'Strong-Password-19',
      confirmPassword: 'Strong-Password-19',
    })
    expect((await client.post('/api/admin/ai-assistant/command').send(COMMAND)).status).toBe(401)
    expect((await client.post('/api/admin/ai-assistant/speak').send(SPEAK)).status).toBe(401)
  })

  it('the legacy shared admin token does not unlock the assistant', async () => {
    const res = await request(createApp())
      .post('/api/admin/ai-assistant/command')
      .set('X-Admin-Token', 'legacy-token-for-test')
      .send(COMMAND)
    expect(res.status).toBe(401)
  })

  it('has no assistant-looking route outside the admin-gated, flag-gated pair (GET/other paths 404 or 401)', async () => {
    const app = createApp()
    for (const path of ['/api/ai-assistant', '/api/ai-assistant/command', '/api/assistant/command', '/api/ai/assistant', '/api/admin/ai-assistant']) {
      const res = await request(app).post(path).send(COMMAND)
      expect([401, 404], path).toContain(res.status)
    }
  })

  it('the service entry points refuse on their own, even if a caller bypasses the route and controller', async () => {
    const { handleAssistantCommand } = await vi.importActual<typeof import('../src/aiAssistant/orchestrator.service.js')>(
      '../src/aiAssistant/orchestrator.service.js',
    )
    const { synthesizeSpeech } = await vi.importActual<typeof import('../src/aiAssistant/elevenLabs.service.js')>(
      '../src/aiAssistant/elevenLabs.service.js',
    )
    await expect(handleAssistantCommand([], 'do something')).rejects.toThrow('AI Assistant is currently disabled.')
    await expect(synthesizeSpeech('hello')).rejects.toThrow('AI Assistant is currently disabled.')
    expect(generateResponse).not.toHaveBeenCalled()
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes('elevenlabs'))).toHaveLength(0)
  })
})

describe('the specialist agents do not depend on the assistant', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      return statSync(full).isDirectory() ? sources(full) : full.endsWith('.ts') ? [full] : []
    })
  }

  it('no backend code outside the assistant\'s own files imports anything from it', () => {
    const root = join(__dirname, '../src')
    const allowed = [
      /[\\/]aiAssistant[\\/]/, // the assistant itself
      /controllers[\\/]adminAiAssistant\.controller\.ts$/,
      /middleware[\\/]requireAiAssistantEnabled\.ts$/,
      /routes[\\/]admin\.routes\.ts$/, // mounts the (gated) routes
    ]
    const offenders = sources(root).filter((file) => {
      if (allowed.some((pattern) => pattern.test(file))) return false
      return /from\s+['"][^'"]*aiAssistant\//.test(readFileSync(file, 'utf8'))
    })
    expect(offenders.map((f) => f.replace(root, ''))).toEqual([])
  })

  it('the assistant\'s code is still in the repository (disabled, not deleted)', () => {
    const root = join(__dirname, '../src/aiAssistant')
    const files = readdirSync(root)
    expect(files).toEqual(expect.arrayContaining(['orchestrator.service.ts', 'elevenLabs.service.ts', 'systemPrompt.ts', 'featureFlag.ts', 'tools']))
  })
})
