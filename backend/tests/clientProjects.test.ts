import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'
import { createClientPortalTables } from './helpers/clientPortalTables.js'

process.env.CLIENT_LOGIN_RATE_LIMIT_MAX = '1000'
process.env.CLIENT_REGISTER_RATE_LIMIT_MAX = '1000'
process.env.CLIENT_PROJECT_RATE_LIMIT_MAX = '1000'
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables(), ...createClientPortalTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

const tables = prisma as unknown as ReturnType<typeof createClientPortalTables> & ReturnType<typeof createAdminAuthTables>

const ADMIN = { email: 'owner@velnora.com', password: 'Admin-Password-123' }

const PROJECT = {
  projectName: 'Ashworth Bakery Online Store',
  projectType: 'ecommerce-website',
  description: 'We need an online store so customers can order bread and cakes for local pickup.',
  websiteUrl: 'https://ashworthbakery.example',
  targetAudience: 'Local families and cafes',
  requiredFeatures: 'Online ordering, pickup slots, Stripe-free invoicing',
  budgetRange: '$1,000–$2,500',
  timeline: '1-3-months',
  additionalNotes: 'We have brand colors ready.',
}

function clientBody(n: number) {
  return {
    name: `Client ${n}`,
    email: `client${n}@example.com`,
    password: `Strong-Password-${n}9`,
    confirmPassword: `Strong-Password-${n}9`,
    phone: `+1 555 010 20${n}0`,
  }
}

/** A fresh agent, signed up (and therefore signed in) as client `n`. */
async function clientAgent(n: number) {
  const agent = request.agent(createApp())
  const res = await agent.post('/api/client/auth/register').send(clientBody(n))
  expect(res.status).toBe(201)
  return { agent, id: res.body.data.client.id as string }
}

async function adminAgent() {
  tables.seedAdminUser({ id: 'admin_1', email: ADMIN.email, passwordHash: await hashPassword(ADMIN.password) })
  const agent = request.agent(createApp())
  const res = await agent.post('/api/auth/admin/login').send(ADMIN)
  expect(res.status).toBe(200)
  return agent
}

async function submit(agent: request.Agent, overrides: Record<string, unknown> = {}) {
  return agent.post('/api/client/projects').send({ ...PROJECT, ...overrides })
}

beforeEach(() => {
  vi.clearAllMocks()
  tables.reset()
})

describe('creating a project', () => {
  it('requires a client session', async () => {
    const res = await request(createApp()).post('/api/client/projects').send(PROJECT)
    expect(res.status).toBe(401)
    expect(tables.project.create).not.toHaveBeenCalled()
  })

  it('saves the project for the signed-in client, starts at NEW_REQUEST, and writes the first history entry', async () => {
    const { agent, id } = await clientAgent(1)
    const res = await submit(agent)

    expect(res.status).toBe(201)
    expect(res.body.message).toBe('Your project request has been received.')
    expect(res.body.data.project).toMatchObject({
      projectName: PROJECT.projectName,
      projectType: 'ecommerce-website',
      status: 'NEW_REQUEST',
      projectNumber: 'VEL-1001',
      budgetRange: '$1,000–$2,500',
    })

    const [stored] = tables.peek.projects()
    expect(stored!.clientId).toBe(id)
    const history = tables.peek.history(stored!.id)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ oldStatus: null, newStatus: 'NEW_REQUEST', message: 'Project submitted' })
  })

  it('assigns sequential, human-readable project numbers', async () => {
    const { agent } = await clientAgent(1)
    const first = await submit(agent)
    const second = await submit(agent, { projectName: 'Second project' })
    expect([first.body.data.project.projectNumber, second.body.data.project.projectNumber]).toEqual(['VEL-1001', 'VEL-1002'])
  })

  it('accepts a minimal valid project (optional fields omitted or blank)', async () => {
    const { agent } = await clientAgent(1)
    const res = await agent.post('/api/client/projects').send({
      projectName: 'Minimal',
      projectType: 'other',
      description: 'Just a description that is long enough.',
      websiteUrl: '',
      budgetRange: '',
      timeline: '',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.project.websiteUrl).toBeNull()
  })

  it('cannot be spoofed: clientId, status, id, projectNumber and timestamps in the body are rejected, nothing is written', async () => {
    const { agent } = await clientAgent(1)
    const other = await clientAgent(2)

    for (const extra of [
      { clientId: other.id },
      { status: 'COMPLETED' },
      { id: 'proj_hacked' },
      { projectNumber: 'VEL-1' },
      { createdAt: '2000-01-01' },
      { userId: other.id },
    ]) {
      const res = await submit(agent, extra)
      expect(res.status).toBe(400)
    }
    expect(tables.peek.projects()).toHaveLength(0)
  })

  const INVALID: Array<[string, Record<string, unknown>]> = [
    ['a missing project name', { projectName: '' }],
    ['a too-short project name', { projectName: 'ab' }],
    ['an unknown project type', { projectType: 'hacking' }],
    ['a missing project type', { projectType: undefined }],
    ['a too-short description', { description: 'too short' }],
    ['an oversized description', { description: 'a'.repeat(5001) }],
    ['a javascript: website URL', { websiteUrl: 'javascript:alert(1)' }],
    ['a data: website URL', { websiteUrl: 'data:text/html,<script>1</script>' }],
    ['an unknown timeline', { timeline: 'yesterday' }],
    ['an oversized budget note', { budgetRange: 'x'.repeat(101) }],
    ['a NUL control character', { description: `${PROJECT.description}\u0000` }],
    ['a non-string description', { description: { $gt: '' } }],
  ]
  for (const [label, override] of INVALID) {
    it(`rejects ${label} with 400 and writes nothing`, async () => {
      const { agent } = await clientAgent(1)
      const res = await submit(agent, override)
      expect(res.status).toBe(400)
      expect(tables.peek.projects()).toHaveLength(0)
    })
  }

  it('stores text that looks like markup as inert plain text (rendered escaped by the UI, never interpreted)', async () => {
    const { agent } = await clientAgent(1)
    const res = await submit(agent, { description: 'Please add a <b>bold</b> hero & a "quoted" slogan to the site.' })
    expect(res.status).toBe(201)
    expect(res.body.data.project.description).toContain('<b>bold</b>')
  })

  it('caps the number of projects one account can create', async () => {
    const { agent, id } = await clientAgent(1)
    for (let i = 0; i < 25; i += 1) tables.seedProject({ clientId: id })
    const res = await submit(agent)
    expect(res.status).toBe(409)
  })
})

describe('reading projects (ownership / IDOR)', () => {
  it('lists only the signed-in client\'s own projects', async () => {
    const alice = await clientAgent(1)
    const bob = await clientAgent(2)
    await submit(alice.agent, { projectName: 'Alice project' })
    await submit(bob.agent, { projectName: 'Bob project' })

    const aliceList = await alice.agent.get('/api/client/projects')
    expect(aliceList.status).toBe(200)
    expect(aliceList.body.data.projects.map((p: { projectName: string }) => p.projectName)).toEqual(['Alice project'])

    const bobList = await bob.agent.get('/api/client/projects')
    expect(bobList.body.data.projects.map((p: { projectName: string }) => p.projectName)).toEqual(['Bob project'])
  })

  it('a client can open their own project and its status history', async () => {
    const { agent } = await clientAgent(1)
    const created = await submit(agent)
    const id = created.body.data.project.id

    const detail = await agent.get(`/api/client/projects/${id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.project.projectName).toBe(PROJECT.projectName)

    const history = await agent.get(`/api/client/projects/${id}/status-history`)
    expect(history.status).toBe(200)
    expect(history.body.data.history).toHaveLength(1)
  })

  it('IDOR: another client\'s project is a 404 on detail AND history — indistinguishable from a nonexistent id', async () => {
    const alice = await clientAgent(1)
    const bob = await clientAgent(2)
    const aliceProject = (await submit(alice.agent)).body.data.project.id

    const detail = await bob.agent.get(`/api/client/projects/${aliceProject}`)
    const history = await bob.agent.get(`/api/client/projects/${aliceProject}/status-history`)
    const missing = await bob.agent.get('/api/client/projects/proj_does_not_exist')

    expect(detail.status).toBe(404)
    expect(history.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(detail.body).toEqual(missing.body) // no oracle for "exists but not yours"
    // The history table was never even queried for a project Bob doesn't own.
    expect(tables.projectStatusHistory.findMany).not.toHaveBeenCalled()
    expect(JSON.stringify(detail.body)).not.toContain(PROJECT.projectName)
  })

  it('IDOR: the ownership scope is applied in the query itself (where { id, clientId }), not after the fact', async () => {
    const alice = await clientAgent(1)
    const bob = await clientAgent(2)
    const aliceProject = (await submit(alice.agent)).body.data.project.id
    await bob.agent.get(`/api/client/projects/${aliceProject}`)

    const where = tables.project.findFirst.mock.calls.at(-1)![0].where
    expect(where).toEqual({ id: aliceProject, clientId: bob.id })
  })

  it('unauthenticated requests cannot read any project endpoint', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id
    const app = createApp()

    for (const path of ['/api/client/projects', `/api/client/projects/${id}`, `/api/client/projects/${id}/status-history`]) {
      expect((await request(app).get(path)).status).toBe(401)
    }
  })

  it('never exposes another client\'s email/phone, internal ids, the sequence, or the admin\'s email to a client', async () => {
    const alice = await clientAgent(1)
    const bob = await clientAgent(2)
    const id = (await submit(alice.agent)).body.data.project.id

    const admin = await adminAgent()
    await admin.patch(`/api/admin/projects/${id}/status`).send({ status: 'REVIEWING', message: 'We are looking at it.' })

    const aliceView = JSON.stringify([
      (await alice.agent.get('/api/client/projects')).body,
      (await alice.agent.get(`/api/client/projects/${id}`)).body,
      (await alice.agent.get(`/api/client/projects/${id}/status-history`)).body,
    ])
    expect(aliceView).not.toContain(ADMIN.email) // changedBy never reaches clients
    expect(aliceView).not.toContain('changedBy')
    expect(aliceView).not.toContain('clientId')
    expect(aliceView).not.toContain('projectSeq')
    expect(aliceView).not.toContain('passwordHash')
    expect(aliceView).not.toContain('client2@example.com')

    const bobView = JSON.stringify((await bob.agent.get('/api/client/projects')).body)
    expect(bobView).not.toContain('client1@example.com')
    expect(bobView).not.toContain(PROJECT.projectName)
  })
})

describe('private responses are never cacheable', () => {
  it('sets Cache-Control: no-store on authenticated and unauthenticated client API responses', async () => {
    const { agent } = await clientAgent(1)
    for (const path of ['/api/client/session', '/api/client/projects']) {
      expect((await agent.get(path)).headers['cache-control'], path).toBe('no-store')
    }
    expect((await request(createApp()).get('/api/client/projects')).headers['cache-control']).toBe('no-store')
    expect((await request(createApp()).post('/api/client/auth/login').send({ email: 'a@b.co', password: 'x' })).headers['cache-control']).toBe('no-store')
  })
})

describe('clients cannot reach admin capabilities', () => {
  it('a client cannot read or change anything through the admin project API', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id

    expect((await alice.agent.get('/api/admin/projects')).status).toBe(401)
    expect((await alice.agent.get(`/api/admin/projects/${id}`)).status).toBe(401)
    const change = await alice.agent.patch(`/api/admin/projects/${id}/status`).send({ status: 'COMPLETED' })
    expect(change.status).toBe(401)
    expect(tables.peek.projects()[0]!.status).toBe('NEW_REQUEST')
  })

  it('there is no client-facing route that can change a status (PATCH/PUT/POST/DELETE all fail)', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id

    for (const [method, path] of [
      ['patch', `/api/client/projects/${id}`],
      ['put', `/api/client/projects/${id}`],
      ['patch', `/api/client/projects/${id}/status`],
      ['post', `/api/client/projects/${id}/status`],
      ['delete', `/api/client/projects/${id}`],
    ] as const) {
      const res = await alice.agent[method](path).send({ status: 'COMPLETED' })
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(404)
    }
    expect(tables.peek.projects()[0]!.status).toBe('NEW_REQUEST')
  })

  it('a client cannot reach Lead Finder data or agent configuration', async () => {
    const alice = await clientAgent(1)
    for (const path of ['/api/leads', '/api/admin/agents/lead-finder/config', '/api/admin/client-leads', '/api/admin/ai-assistant/command']) {
      expect([401, 404, 405]).toContain((await alice.agent.get(path)).status)
    }
  })
})

describe('admin project management', () => {
  it('requires an admin session', async () => {
    const app = createApp()
    expect((await request(app).get('/api/admin/projects')).status).toBe(401)
    expect((await request(app).patch('/api/admin/projects/x/status').send({ status: 'APPROVED' })).status).toBe(401)
    expect((await request(app).get('/api/admin/projects').set('X-Admin-Token', 'legacy')).status).toBe(401)
  })

  it('lists projects with client info, newest first, with pagination metadata', async () => {
    const alice = await clientAgent(1)
    const bob = await clientAgent(2)
    await submit(alice.agent, { projectName: 'First one' })
    await submit(bob.agent, { projectName: 'Second one' })
    const admin = await adminAgent()

    const res = await admin.get('/api/admin/projects')
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(2)
    expect(res.body.data.projects.map((p: { projectName: string }) => p.projectName)).toEqual(['Second one', 'First one'])
    expect(res.body.data.projects[0].client).toEqual({
      name: 'Client 2',
      email: 'client2@example.com',
      phone: '+1 555 010 2020',
      company: null,
    })
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
  })

  it('searches by project name, client email/name, and project number; filters by status', async () => {
    const alice = await clientAgent(1)
    const bob = await clientAgent(2)
    const a = (await submit(alice.agent, { projectName: 'Bakery store' })).body.data.project
    await submit(bob.agent, { projectName: 'Law firm site' })
    const admin = await adminAgent()
    await admin.patch(`/api/admin/projects/${a.id}/status`).send({ status: 'APPROVED' })

    const names = async (qs: string) =>
      (await admin.get(`/api/admin/projects?${qs}`)).body.data.projects.map((p: { projectName: string }) => p.projectName)

    expect(await names('search=bakery')).toEqual(['Bakery store'])
    expect(await names('search=client2@example')).toEqual(['Law firm site'])
    expect(await names('search=Client%201')).toEqual(['Bakery store'])
    expect(await names('search=VEL-1002')).toEqual(['Law firm site'])
    expect(await names('status=APPROVED')).toEqual(['Bakery store'])
    expect(await names('status=NEW_REQUEST')).toEqual(['Law firm site'])
  })

  it('rejects invalid list filters (unknown status, bad paging)', async () => {
    const admin = await adminAgent()
    for (const qs of ['status=HACKED', 'page=0', 'pageSize=1000', 'sort=random', 'unknown=1']) {
      expect((await admin.get(`/api/admin/projects?${qs}`)).status, qs).toBe(400)
    }
  })

  it('shows full detail: client contact info and the history including who changed what', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id
    const admin = await adminAgent()

    const res = await admin.get(`/api/admin/projects/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.project.client.email).toBe('client1@example.com')
    expect(res.body.data.project.statusHistory[0]).toMatchObject({ newStatus: 'NEW_REQUEST', changedBy: 'client' })
  })

  it('404s an unknown project id', async () => {
    const admin = await adminAgent()
    expect((await admin.get('/api/admin/projects/nope')).status).toBe(404)
    expect((await admin.patch('/api/admin/projects/nope/status').send({ status: 'APPROVED' })).status).toBe(404)
  })
})

describe('status changes', () => {
  it('admin changes the status: history is written with the admin as editor, and the CLIENT sees the update', async () => {
    const alice = await clientAgent(1)
    const created = (await submit(alice.agent)).body.data.project
    const admin = await adminAgent()

    const res = await admin
      .patch(`/api/admin/projects/${created.id}/status`)
      .send({ status: 'IN_PROGRESS', message: 'Development has started.' })

    expect(res.status).toBe(200)
    expect(res.body.data.project.status).toBe('IN_PROGRESS')
    expect(res.body.data.project.statusHistory.at(-1)).toMatchObject({
      oldStatus: 'NEW_REQUEST',
      newStatus: 'IN_PROGRESS',
      message: 'Development has started.',
      changedBy: ADMIN.email,
    })

    // The same client logs in later and sees the new state.
    const returning = request.agent(createApp())
    await returning.post('/api/client/auth/login').send({ email: 'client1@example.com', password: 'Strong-Password-19' })
    const detail = await returning.get(`/api/client/projects/${created.id}`)
    expect(detail.body.data.project.status).toBe('IN_PROGRESS')
    const history = await returning.get(`/api/client/projects/${created.id}/status-history`)
    expect(history.body.data.history.map((h: { newStatus: string }) => h.newStatus)).toEqual(['NEW_REQUEST', 'IN_PROGRESS'])
    expect(history.body.data.history[1].message).toBe('Development has started.')
  })

  it('takes the editor identity from the admin session — a body-supplied changedBy/clientId is rejected', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id
    const admin = await adminAgent()

    for (const extra of [{ changedBy: 'ceo@velnora.com' }, { clientId: 'x' }, { oldStatus: 'COMPLETED' }]) {
      const res = await admin.patch(`/api/admin/projects/${id}/status`).send({ status: 'APPROVED', ...extra })
      expect(res.status).toBe(400)
    }
    expect(tables.peek.projects()[0]!.status).toBe('NEW_REQUEST')
  })

  it('rejects invalid statuses (unknown, lowercase, missing, non-string) and writes no history', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id
    const admin = await adminAgent()

    for (const status of ['DONE', 'in_progress', '', undefined, 7, { $ne: 1 }, 'NEW_REQUEST; DROP TABLE projects']) {
      const res = await admin.patch(`/api/admin/projects/${id}/status`).send({ status })
      expect(res.status, JSON.stringify(status)).toBe(400)
    }
    expect(tables.peek.history(id)).toHaveLength(1)
    expect(tables.peek.projects()[0]!.status).toBe('NEW_REQUEST')
  })

  it('rejects an oversized message and a no-op change to the same status', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id
    const admin = await adminAgent()

    expect((await admin.patch(`/api/admin/projects/${id}/status`).send({ status: 'REVIEWING', message: 'x'.repeat(1001) })).status).toBe(400)
    expect((await admin.patch(`/api/admin/projects/${id}/status`).send({ status: 'NEW_REQUEST' })).status).toBe(409)
    expect(tables.peek.history(id)).toHaveLength(1)
  })

  it('returns 409 (not a silent overwrite) when the status changed under the admin\'s feet', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id
    const admin = await adminAgent()
    // Simulate a concurrent admin moving the project between our read and write.
    tables.project.updateMany.mockImplementationOnce(async () => ({ count: 0 }))

    const res = await admin.patch(`/api/admin/projects/${id}/status`).send({ status: 'APPROVED' })
    expect(res.status).toBe(409)
    expect(tables.peek.history(id)).toHaveLength(1)
  })

  it('walks the full lifecycle and records every step in order', async () => {
    const alice = await clientAgent(1)
    const id = (await submit(alice.agent)).body.data.project.id
    const admin = await adminAgent()
    const steps = ['REVIEWING', 'APPROVED', 'IN_PROGRESS', 'CLIENT_REVIEW', 'REVISION', 'IN_PROGRESS', 'ON_HOLD', 'IN_PROGRESS', 'COMPLETED']

    for (const status of steps) {
      expect((await admin.patch(`/api/admin/projects/${id}/status`).send({ status })).status, status).toBe(200)
    }
    const history = await alice.agent.get(`/api/client/projects/${id}/status-history`)
    expect(history.body.data.history.map((h: { newStatus: string }) => h.newStatus)).toEqual(['NEW_REQUEST', ...steps])
  })
})

describe('acceptance: the complete journey', () => {
  it('sign up → submit project → dashboard → admin sees it → admin updates → client sees update → no cross-client access', async () => {
    // 1–6. A visitor creates an account and is authenticated.
    const alice = request.agent(createApp())
    const signup = await alice.post('/api/client/auth/register').send(clientBody(1))
    expect(signup.status).toBe(201)
    expect((await alice.get('/api/client/session')).status).toBe(200)

    // 7–9. Submits the project; it is saved.
    const submitted = await submit(alice)
    expect(submitted.status).toBe(201)
    const projectId = submitted.body.data.project.id

    // 10–11. Dashboard shows it as a received request.
    const dashboard = await alice.get('/api/client/projects')
    expect(dashboard.body.data.projects).toHaveLength(1)
    expect(dashboard.body.data.projects[0]).toMatchObject({ projectNumber: 'VEL-1001', status: 'NEW_REQUEST' })

    // 12–14. Admin sees it and changes the status; history is created.
    const admin = await adminAgent()
    const adminList = await admin.get('/api/admin/projects')
    expect(adminList.body.data.projects[0].client.email).toBe('client1@example.com')
    const changed = await admin.patch(`/api/admin/projects/${projectId}/status`).send({ status: 'APPROVED', message: 'Approved — we start next week.' })
    expect(changed.status).toBe(200)
    expect(tables.peek.history(projectId)).toHaveLength(2)

    // 15–16. Client logs in again on the same site and sees the update.
    const later = request.agent(createApp())
    expect((await later.post('/api/client/auth/login').send({ email: 'client1@example.com', password: 'Strong-Password-19' })).status).toBe(200)
    expect((await later.get(`/api/client/projects/${projectId}`)).body.data.project.status).toBe('APPROVED')

    // 17–18. Another client sees nothing of it and can't change anything.
    const mallory = await clientAgent(2)
    expect((await mallory.agent.get('/api/client/projects')).body.data.projects).toEqual([])
    expect((await mallory.agent.get(`/api/client/projects/${projectId}`)).status).toBe(404)
    expect((await mallory.agent.patch(`/api/admin/projects/${projectId}/status`).send({ status: 'COMPLETED' })).status).toBe(401)
    expect(tables.peek.projects()[0]!.status).toBe('APPROVED')
  })
})
