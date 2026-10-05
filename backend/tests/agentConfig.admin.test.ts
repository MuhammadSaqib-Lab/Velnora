import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'
import { createAgentConfigTables } from './helpers/agentConfigTables.js'

process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'
process.env.AGENT_CONFIG_RATE_LIMIT_MAX = '1000'
// Secrets that must never show up in any agent-config response.
const SECRETS = {
  ANTHROPIC_API_KEY: 'sk-ant-test-SECRET-sentinel-111',
  LEAD_FINDER_ADMIN_TOKEN: 'legacy-token-SECRET-sentinel-222',
  GOOGLE_CLIENT_SECRET: 'google-client-SECRET-sentinel-333',
  GOOGLE_REFRESH_TOKEN: 'google-refresh-SECRET-sentinel-444',
  ELEVENLABS_API_KEY: 'eleven-SECRET-sentinel-555',
}
Object.assign(process.env, SECRETS)

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    ...createAdminAuthTables(),
    ...createAgentConfigTables(),
  },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')
const { getAgentDefaults } = await import('../src/agentConfig/defaults.js')

const DEFAULTS_FOR_TEST = {
  CUSTOMER_HANDLER: getAgentDefaults('CUSTOMER_HANDLER'),
  LEAD_FINDER: getAgentDefaults('LEAD_FINDER'),
}

const tables = prisma as unknown as ReturnType<typeof createAdminAuthTables> & ReturnType<typeof createAgentConfigTables>

const TEST_EMAIL = 'owner@velnora.com'
const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-9'
const BASE = '/api/admin/agents'
const AGENTS = [
  { slug: 'customer-handler', key: 'CUSTOMER_HANDLER', other: 'LEAD_FINDER' },
  { slug: 'lead-finder', key: 'LEAD_FINDER', other: 'CUSTOMER_HANDLER' },
] as const

async function loggedInAgent(app: ReturnType<typeof createApp>) {
  tables.seedAdminUser({ id: 'admin_test_1', email: TEST_EMAIL, passwordHash: await hashPassword(TEST_PASSWORD) })
  const agent = request.agent(app)
  await agent.post('/api/auth/admin/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD })
  return agent
}

const VALID_INSTRUCTIONS = 'You are a helpful agent for Velnora. Keep things professional.'

beforeEach(() => {
  tables.reset()
})

describe('authorization', () => {
  for (const { slug } of AGENTS) {
    it(`rejects every ${slug} config endpoint without a session (401) and never touches the database`, async () => {
      const app = createApp()
      const body = { rules: '', instructions: VALID_INSTRUCTIONS, enabled: true, expectedVersion: 1 }

      const responses = await Promise.all([
        request(app).get(`${BASE}/${slug}/config`),
        request(app).patch(`${BASE}/${slug}/config`).send(body),
        request(app).get(`${BASE}/${slug}/config/history`),
        request(app).post(`${BASE}/${slug}/config/restore`).send({ version: 1, expectedVersion: 1 }),
      ])

      for (const res of responses) expect(res.status).toBe(401)
      expect(tables.agentConfig.findUnique).not.toHaveBeenCalled()
      expect(tables.agentConfig.create).not.toHaveBeenCalled()
      expect(tables.agentConfig.updateMany).not.toHaveBeenCalled()
    })

    it(`does not accept the legacy shared X-Admin-Token for ${slug} config (session-only)`, async () => {
      const app = createApp()
      const headers = { 'X-Admin-Token': SECRETS.LEAD_FINDER_ADMIN_TOKEN }
      const read = await request(app).get(`${BASE}/${slug}/config`).set(headers)
      const write = await request(app)
        .patch(`${BASE}/${slug}/config`)
        .set(headers)
        .send({ rules: '', instructions: VALID_INSTRUCTIONS, enabled: true, expectedVersion: 1 })

      expect(read.status).toBe(401)
      expect(write.status).toBe(401)
      expect(tables.agentConfig.updateMany).not.toHaveBeenCalled()
    })

    it(`rejects a forged / unknown session cookie for ${slug}`, async () => {
      const app = createApp()
      const res = await request(app)
        .patch(`${BASE}/${slug}/config`)
        .set('Cookie', 'velnora_admin_session=not-a-real-token')
        .send({ rules: '', instructions: VALID_INSTRUCTIONS, enabled: false, expectedVersion: 1 })
      expect(res.status).toBe(401)
      expect(tables.peekConfig(slug === 'lead-finder' ? 'LEAD_FINDER' : 'CUSTOMER_HANDLER')).toBeUndefined()
    })
  }
})

describe('reading configuration', () => {
  for (const { slug, key } of AGENTS) {
    it(`admin can read ${slug}: seeded defaults, status fields, nothing sensitive`, async () => {
      const app = createApp()
      const agent = await loggedInAgent(app)
      const res = await agent.get(`${BASE}/${slug}/config`)

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        agentKey: key,
        enabled: true,
        version: 1,
        rules: DEFAULTS_FOR_TEST[key].rules,
        instructions: DEFAULTS_FOR_TEST[key].instructions,
      })
      expect(res.body.data).toHaveProperty('updatedAt')
      expect(res.body.data).toHaveProperty('updatedBy')
      expect(res.body.data).not.toHaveProperty('id')

      const raw = JSON.stringify(res.body)
      for (const secret of Object.values(SECRETS)) expect(raw).not.toContain(secret)
    })
  }

  it('reading one agent never reads or creates the other agent\'s row', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    await agent.get(`${BASE}/customer-handler/config`)

    const queried = tables.agentConfig.findUnique.mock.calls.map((c) => c[0].where.agentKey)
    expect(new Set(queried)).toEqual(new Set(['CUSTOMER_HANDLER']))
    expect(tables.peekConfig('LEAD_FINDER')).toBeUndefined()
  })

  it('returns 404 for any agent slug outside the allowlist, and never a different agent\'s config', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    for (const slug of ['ai-assistant', 'CUSTOMER_HANDLER', '..%2Flead-finder', 'customer-handler%2F..%2Flead-finder', '*']) {
      const res = await agent.get(`${BASE}/${slug}/config`)
      expect(res.status).toBe(404)
    }
    expect(tables.agentConfig.findUnique).not.toHaveBeenCalled()
  })
})

describe('updating configuration', () => {
  for (const { slug, key, other } of AGENTS) {
    it(`admin can update ${slug}: bumps version, records the editor from the session, writes history, leaves the other agent alone`, async () => {
      const app = createApp()
      const agent = await loggedInAgent(app)
      await agent.get(`${BASE}/${slug}/config`) // seeds v1

      const res = await agent.patch(`${BASE}/${slug}/config`).send({
        rules: '- Always greet warmly.\r\n- Never use jargon.',
        instructions: VALID_INSTRUCTIONS,
        enabled: false,
        expectedVersion: 1,
      })

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Configuration saved.')
      expect(res.body.data).toMatchObject({
        agentKey: key,
        enabled: false,
        version: 2,
        updatedBy: TEST_EMAIL,
        rules: '- Always greet warmly.\n- Never use jargon.', // CRLF normalized
      })

      const versions = tables.peekVersions(key).map((v) => [v.version, v.changeType, v.changedBy])
      expect(versions).toEqual([
        [1, 'SEEDED', 'system (initial defaults)'],
        [2, 'UPDATED', TEST_EMAIL],
      ])
      expect(tables.peekConfig(other)).toBeUndefined()
    })
  }

  it('takes the editor identity from the session — a client-supplied updatedBy/agentKey/version/id is rejected outright', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const base = { rules: '', instructions: VALID_INSTRUCTIONS, enabled: true, expectedVersion: 1 }

    for (const extra of [
      { updatedBy: 'someone-else@evil.test' },
      { agentKey: 'LEAD_FINDER' },
      { id: 'cfg_1' },
      { version: 99 },
    ]) {
      const res = await agent.patch(`${BASE}/customer-handler/config`).send({ ...base, ...extra })
      expect(res.status).toBe(400)
    }
    expect(tables.agentConfig.updateMany).not.toHaveBeenCalled()
  })

  const INVALID_BODIES: Array<[string, Record<string, unknown>]> = [
    ['oversized instructions', { instructions: 'a'.repeat(8001) }],
    ['oversized rules', { rules: 'a'.repeat(6001) }],
    ['a multi-megabyte payload', { instructions: 'a'.repeat(2_000_000) }],
    ['instructions that are too short', { instructions: 'hi' }],
    ['missing instructions', { instructions: undefined }],
    ['non-string rules', { rules: 42 }],
    ['non-boolean enabled', { enabled: 'yes' }],
    ['missing enabled', { enabled: undefined }],
    ['missing expectedVersion', { expectedVersion: undefined }],
    ['non-integer expectedVersion', { expectedVersion: 1.5 }],
    ['zero expectedVersion', { expectedVersion: 0 }],
    ['a <script> tag', { instructions: `${VALID_INSTRUCTIONS} <script>alert(1)</script>` }],
    ['an inline event handler', { rules: '<img src=x onerror=alert(1)>' }],
    ['a javascript: URL', { rules: 'visit javascript:alert(1)' }],
    ['a NUL control character', { instructions: `${VALID_INSTRUCTIONS}\u0000` }],
  ]
  for (const [label, override] of INVALID_BODIES) {
    it(`rejects ${label} with 400 before any write`, async () => {
      const app = createApp()
      const agent = await loggedInAgent(app)
      const res = await agent
        .patch(`${BASE}/lead-finder/config`)
        .send({ rules: '', instructions: VALID_INSTRUCTIONS, enabled: true, expectedVersion: 1, ...override })

      expect([400, 413]).toContain(res.status)
      expect(res.body.success).toBe(false)
      expect(tables.agentConfig.updateMany).not.toHaveBeenCalled()
    })
  }

  it('accepts angle-bracket text that is not active content (e.g. a <name> placeholder)', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const res = await agent.patch(`${BASE}/customer-handler/config`).send({
      rules: 'Address the visitor as <name> when known. 2 < 3 and 5 > 4.',
      instructions: VALID_INSTRUCTIONS,
      enabled: true,
      expectedVersion: 1,
    })
    expect(res.status).toBe(200)
  })

  it('rejects a stale expectedVersion with 409 and does not overwrite', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    await agent.get(`${BASE}/customer-handler/config`)
    await agent
      .patch(`${BASE}/customer-handler/config`)
      .send({ rules: 'first edit', instructions: VALID_INSTRUCTIONS, enabled: true, expectedVersion: 1 })

    const stale = await agent
      .patch(`${BASE}/customer-handler/config`)
      .send({ rules: 'stale edit', instructions: VALID_INSTRUCTIONS, enabled: true, expectedVersion: 1 })

    expect(stale.status).toBe(409)
    expect(tables.peekConfig('CUSTOMER_HANDLER')?.rules).toBe('first edit')
  })

  it('a save with no actual changes does not create a new version', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    const current = (await agent.get(`${BASE}/customer-handler/config`)).body.data
    const res = await agent.patch(`${BASE}/customer-handler/config`).send({
      rules: current.rules,
      instructions: current.instructions,
      enabled: current.enabled,
      expectedVersion: current.version,
    })
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('No changes to save.')
    expect(tables.peekVersions('CUSTOMER_HANDLER')).toHaveLength(1)
  })

  it('never leaks database details or stack traces when the database fails', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    tables.agentConfig.findUnique.mockRejectedValueOnce(
      new Error('password authentication failed for user "velnora_app" at /srv/backend/node_modules/pg/lib/x.js:42'),
    )
    const res = await agent.get(`${BASE}/lead-finder/config`)

    expect(res.status).toBe(500)
    const raw = JSON.stringify(res.body)
    expect(raw).not.toContain('velnora_app')
    expect(raw).not.toContain('node_modules')
    expect(raw).not.toMatch(/\bat\s+\S+:\d+/)
  })
})

describe('history and restore', () => {
  it('lists history newest-first and restores an earlier version as a NEW version', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    await agent.get(`${BASE}/lead-finder/config`)
    await agent
      .patch(`${BASE}/lead-finder/config`)
      .send({ rules: 'edited rules', instructions: VALID_INSTRUCTIONS, enabled: true, expectedVersion: 1 })

    const history = await agent.get(`${BASE}/lead-finder/config/history`)
    expect(history.status).toBe(200)
    expect(history.body.data.versions.map((v: { version: number }) => v.version)).toEqual([2, 1])

    const restored = await agent.post(`${BASE}/lead-finder/config/restore`).send({ version: 1, expectedVersion: 2 })
    expect(restored.status).toBe(200)
    expect(restored.body.data).toMatchObject({
      version: 3,
      rules: DEFAULTS_FOR_TEST.LEAD_FINDER.rules,
      updatedBy: TEST_EMAIL,
    })
    expect(tables.peekVersions('LEAD_FINDER').map((v) => v.changeType)).toEqual(['SEEDED', 'UPDATED', 'RESTORED'])
  })

  it('cannot restore another agent\'s version through this agent\'s endpoint', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    await agent.get(`${BASE}/customer-handler/config`)
    await agent.get(`${BASE}/lead-finder/config`)
    await agent
      .patch(`${BASE}/customer-handler/config`)
      .send({ rules: 'CH only edit', instructions: VALID_INSTRUCTIONS, enabled: true, expectedVersion: 1 })

    // Customer Handler has a v2; Lead Finder does not.
    const res = await agent.post(`${BASE}/lead-finder/config/restore`).send({ version: 2, expectedVersion: 1 })
    expect(res.status).toBe(404)
    expect(tables.peekConfig('LEAD_FINDER')?.rules).toBe(DEFAULTS_FOR_TEST.LEAD_FINDER.rules)
  })

  it('rejects a malformed restore body', async () => {
    const app = createApp()
    const agent = await loggedInAgent(app)
    for (const body of [{}, { version: 'one', expectedVersion: 1 }, { version: 1 }, { version: 1, expectedVersion: 1, agentKey: 'LEAD_FINDER' }]) {
      const res = await agent.post(`${BASE}/customer-handler/config/restore`).send(body)
      expect(res.status).toBe(400)
    }
  })
})
