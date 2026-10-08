import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'
import { createClientPortalTables } from './helpers/clientPortalTables.js'

// Small, deterministic limits set before env.ts loads (same pattern as
// the other rate-limit tests). Each limiter is a module-level singleton
// shared by every request in this file, so the tests below run in a fixed
// order and each one's budget is spelled out:
//   register (max 3): form-POST test uses 1, sign-up test uses 2 then hits the cap
//   login    (max 3): project test uses 1, brute-force test uses 2 then hits the cap
//   projects (max 2): project test uses 2 then hits the cap
process.env.CLIENT_REGISTER_RATE_LIMIT_MAX = '3'
process.env.CLIENT_LOGIN_RATE_LIMIT_MAX = '3'
process.env.CLIENT_PROJECT_RATE_LIMIT_MAX = '2'
process.env.CLIENT_LOGIN_RATE_LIMIT_WINDOW_MS = '60000'
process.env.CLIENT_REGISTER_RATE_LIMIT_WINDOW_MS = '60000'
process.env.CLIENT_PROJECT_RATE_LIMIT_WINDOW_MS = '60000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables(), ...createClientPortalTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')
const tables = prisma as unknown as ReturnType<typeof createClientPortalTables>

const PROJECT = {
  projectName: 'Rate limit project',
  projectType: 'other',
  description: 'A description that is comfortably long enough.',
}

describe('Client Portal rate limiting and request-forgery resistance', () => {
  it('a cross-site form-style POST (urlencoded, no JSON) cannot create an account or a project', async () => {
    const app = createApp()
    const form = await request(app)
      .post('/api/client/auth/register')
      .type('form')
      .send({ name: 'Eve', email: 'eve@example.com', password: 'Strong-Password-19', confirmPassword: 'Strong-Password-19' })
    expect(form.status).toBe(400) // the body is never parsed as a form, so validation fails
    expect(tables.peek.users()).toHaveLength(0)

    const text = await request(app).post('/api/client/projects').set('Content-Type', 'text/plain').send(JSON.stringify(PROJECT))
    expect(text.status).toBe(401) // and with no session cookie it never gets as far as validation
  })

  it('limits project submissions, then returns 429 — reads stay available', async () => {
    tables.seedClient({ id: 'client_rl', email: 'rl@example.com', passwordHash: await hashPassword('Strong-Password-19') })
    const agent = request.agent(createApp())
    const login = await agent.post('/api/client/auth/login').send({ email: 'rl@example.com', password: 'Strong-Password-19' })
    expect(login.status).toBe(200)

    const first = await agent.post('/api/client/projects').send(PROJECT)
    const second = await agent.post('/api/client/projects').send(PROJECT)
    const third = await agent.post('/api/client/projects').send(PROJECT)
    expect([first.status, second.status, third.status]).toEqual([201, 201, 429])
    expect(tables.peek.projects()).toHaveLength(2)
    expect((await agent.get('/api/client/projects')).status).toBe(200)
  })

  it('limits login attempts per IP (brute-force defense), then returns 429', async () => {
    const app = createApp()
    const attempt = () => request(app).post('/api/client/auth/login').send({ email: 'victim@example.com', password: 'Guess-Number-1' })

    const statuses = [(await attempt()).status, (await attempt()).status, (await attempt()).status]
    expect(statuses).toEqual([401, 401, 429])
  })

  it('limits sign-ups per IP, then returns 429 and creates no further accounts', async () => {
    const app = createApp()
    const before = tables.peek.users().length
    const signUp = (n: number) =>
      request(app)
        .post('/api/client/auth/register')
        .send({ name: `User ${n}`, email: `user${n}@example.com`, password: `Strong-Password-${n}9`, confirmPassword: `Strong-Password-${n}9` })

    expect([(await signUp(1)).status, (await signUp(2)).status]).toEqual([201, 201])
    const blocked = await signUp(3)
    expect(blocked.status).toBe(429)
    expect(blocked.body).toMatchObject({ success: false })
    expect(tables.peek.users()).toHaveLength(before + 2)
  })

  it('rejects cross-origin browser requests from an origin that is not the frontend (CORS allowlist)', async () => {
    const res = await request(createApp())
      .post('/api/client/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@example.com', password: 'x' })
    expect(res.status).toBe(403)
  })
})
