import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'
import { createClientPortalTables } from './helpers/clientPortalTables.js'

process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'
process.env.LEAD_FINDER_ADMIN_TOKEN = 'legacy-shared-token-for-tests-1234567890'

type Row = Record<string, unknown>

/** An in-memory table that supports exactly what the counts use: count({ where }) with equality or `in`. */
function countableTable(initial: Row[] = []) {
  const rows: Row[] = [...initial]
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([key, cond]) =>
      cond !== null && typeof cond === 'object' && 'in' in (cond as Row) ? ((cond as { in: unknown[] }).in).includes(row[key]) : row[key] === cond,
    )
  return {
    rows,
    count: vi.fn(async ({ where }: { where?: Row } = {}) => rows.filter((r) => matches(r, where)).length),
    // Anything that would read records (rather than count them) must fail the test loudly.
    findMany: vi.fn(async () => {
      throw new Error('the counts endpoint must never fetch records')
    }),
  }
}

const tables = {
  qualifiedLead: countableTable(),
  lead: countableTable(),
  project: countableTable(),
  review: countableTable(),
  socialContentDraft: countableTable(),
}

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables(), ...createClientPortalTables(), ...tables },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')
const { clearAdminSessionCache } = await import('../src/services/adminAuth.service.js')
const { sidebarCountsSchema } = await import('../src/services/adminCounts.service.js')

const URL = '/api/admin/counts'
const EMAIL = 'owner@velnora.com'
const PASSWORD = 'Correct-Horse-Battery-Staple-9'

function seed(over: Partial<Record<keyof typeof tables, Row[]>> = {}) {
  for (const [name, table] of Object.entries(tables)) {
    table.rows.length = 0
    table.rows.push(...(over[name as keyof typeof tables] ?? []))
    table.count.mockClear()
    table.findMany.mockClear()
  }
}
const make = (n: number, base: Row) => Array.from({ length: n }, (_, i) => ({ id: `${base.status}_${i}`, ...base }))

async function admin() {
  ;(prisma as unknown as ReturnType<typeof createAdminAuthTables>).seedAdminUser({ id: 'admin_1', email: EMAIL, passwordHash: await hashPassword(PASSWORD) })
  const agent = request.agent(createApp())
  expect((await agent.post('/api/auth/admin/login').send({ email: EMAIL, password: PASSWORD })).status).toBe(200)
  return agent
}

beforeEach(() => {
  clearAdminSessionCache()
  seed()
})

describe('GET /api/admin/counts — access control', () => {
  it('requires an admin session', async () => {
    const res = await request(createApp()).get(URL)
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'Unauthorized. Please sign in again.' })
    for (const table of Object.values(tables)) expect(table.count).not.toHaveBeenCalled() // nothing was queried
  })

  it('rejects the legacy shared token, a forged cookie and a client-portal cookie', async () => {
    const app = createApp()
    expect((await request(app).get(URL).set('X-Admin-Token', process.env.LEAD_FINDER_ADMIN_TOKEN!)).status).toBe(401)
    expect((await request(app).get(URL).set('Cookie', 'velnora_admin_session=not-a-real-session-token')).status).toBe(401)
    expect((await request(app).get(URL).set('Cookie', 'velnora_client_session=some-client-session')).status).toBe(401)
  })

  it('does not accept a logged-out session', async () => {
    const agent = await admin()
    expect((await agent.get(URL)).status).toBe(200)
    await agent.post('/api/auth/admin/logout').send({})
    expect((await agent.get(URL)).status).toBe(401)
  })
})

describe('GET /api/admin/counts — what is counted', () => {
  it('counts only items waiting for an admin, per the existing status models', async () => {
    seed({
      qualifiedLead: [...make(3, { status: 'NEW' }), ...make(5, { status: 'IN_PROGRESS' }), ...make(4, { status: 'RESOLVED' }), ...make(2, { status: 'ARCHIVED' })],
      // Discovery saves leads as RESEARCHED, so both NEW and RESEARCHED are "not yet triaged"; everything later is history.
      lead: [...make(2, { status: 'NEW' }), ...make(4, { status: 'RESEARCHED' }), ...make(6, { status: 'QUALIFIED' }), ...make(3, { status: 'EMAIL_DRAFTED' }), ...make(7, { status: 'CONTACTED' }), ...make(2, { status: 'CONVERTED' }), ...make(5, { status: 'DISQUALIFIED' }), ...make(1, { status: 'NOT_INTERESTED' })],
      project: [...make(2, { status: 'NEW_REQUEST' }), ...make(3, { status: 'REVIEWING' }), ...make(4, { status: 'IN_PROGRESS' }), ...make(5, { status: 'COMPLETED' })],
      review: [...make(4, { status: 'PENDING' }), ...make(9, { status: 'APPROVED' }), ...make(2, { status: 'REJECTED' })],
      socialContentDraft: [...make(3, { status: 'IN_REVIEW' }), ...make(6, { status: 'DRAFT' }), ...make(2, { status: 'APPROVED' }), ...make(1, { status: 'REJECTED' }), ...make(8, { status: 'ARCHIVED' })],
    })
    const res = await (await admin()).get(URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      message: 'OK',
      data: { clientAgentLeads: 3, leadFinder: 6, projects: 2, reviews: 4, digitalMarketing: 3 },
    })
  })

  it('is an empty queue (0), not an error, when nothing is waiting', async () => {
    const res = await (await admin()).get(URL)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ clientAgentLeads: 0, leadFinder: 0, projects: 0, reviews: 0, digitalMarketing: 0 })
  })

  it('follows the data: a new item raises a count, and moving it on lowers it again', async () => {
    const agent = await admin()
    seed({ review: make(1, { status: 'PENDING' }) })
    expect((await agent.get(URL)).body.data.reviews).toBe(1)

    tables.review.rows.push({ id: 'r_new', status: 'PENDING' }) // a visitor submits a review
    tables.project.rows.push({ id: 'p_new', status: 'NEW_REQUEST' }) // a client submits a project
    tables.lead.rows.push({ id: 'l_new', status: 'RESEARCHED' }) // Lead Finder saves a discovery
    tables.qualifiedLead.rows.push({ id: 'q_new', status: 'NEW' }) // the chat agent captures a lead
    tables.socialContentDraft.rows.push({ id: 'd_new', status: 'DRAFT' }) // a draft that has NOT been sent for review
    let data = (await agent.get(URL)).body.data
    expect(data).toEqual({ clientAgentLeads: 1, leadFinder: 1, projects: 1, reviews: 2, digitalMarketing: 0 })

    tables.socialContentDraft.rows[0]!.status = 'IN_REVIEW' // sent for approval
    tables.review.rows[0]!.status = 'APPROVED' // moderated
    tables.project.rows[0]!.status = 'REVIEWING' // an admin picked it up
    tables.lead.rows[0]!.status = 'QUALIFIED' // triaged
    tables.qualifiedLead.rows[0]!.status = 'IN_PROGRESS'
    data = (await agent.get(URL)).body.data
    expect(data).toEqual({ clientAgentLeads: 0, leadFinder: 0, projects: 0, reviews: 1, digitalMarketing: 1 })
  })

  it('returns large counts as plain numbers (the "99+" display is a frontend rule)', async () => {
    seed({ lead: make(150, { status: 'RESEARCHED' }) })
    expect((await (await admin()).get(URL)).body.data.leadFinder).toBe(150)
  })

  it('only counts: it never reads records, so no lead, customer or review content can leak', async () => {
    seed({
      qualifiedLead: [{ id: 'q', status: 'NEW', name: 'Private Person', email: 'private@example.com', requirements: 'secret scope' }],
      review: [{ id: 'r', status: 'PENDING', name: 'Reviewer', email: 'reviewer@example.com', reviewText: 'private words' }],
      project: [{ id: 'p', status: 'NEW_REQUEST', projectName: 'Confidential project', description: 'secret' }],
    })
    const res = await (await admin()).get(URL)
    const raw = JSON.stringify(res.body)
    expect(raw).not.toMatch(/Private Person|private@|secret|Reviewer|private words|Confidential/)
    for (const table of Object.values(tables)) expect(table.findMany).not.toHaveBeenCalled()
    expect(Object.keys(res.body.data).sort()).toEqual(['clientAgentLeads', 'digitalMarketing', 'leadFinder', 'projects', 'reviews'])
    expect(sidebarCountsSchema.safeParse(res.body.data).success).toBe(true) // the documented contract
  })

  it('is never cached by the browser or a shared cache', async () => {
    const res = await (await admin()).get(URL)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('uses one indexed count per section — five queries, no more', async () => {
    await (await admin()).get(URL)
    for (const table of Object.values(tables)) expect(table.count).toHaveBeenCalledTimes(1)
    expect(tables.lead.count).toHaveBeenCalledWith({ where: { status: { in: ['NEW', 'RESEARCHED'] } } })
    expect(tables.qualifiedLead.count).toHaveBeenCalledWith({ where: { status: 'NEW' } })
    expect(tables.project.count).toHaveBeenCalledWith({ where: { status: 'NEW_REQUEST' } })
    expect(tables.review.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } })
    expect(tables.socialContentDraft.count).toHaveBeenCalledWith({ where: { status: 'IN_REVIEW' } })
  })
})

describe('GET /api/admin/counts — failures never become fake zeros', () => {
  it('reports an unavailable section as null and still returns the others', async () => {
    const agent = await admin()
    seed({ review: make(2, { status: 'PENDING' }), project: make(1, { status: 'NEW_REQUEST' }) })
    tables.socialContentDraft.count.mockRejectedValueOnce(new Error('relation "social_content_drafts" does not exist (the marketing migration has not been applied)'))

    const res = await agent.get(URL)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ clientAgentLeads: 0, leadFinder: 0, projects: 1, reviews: 2, digitalMarketing: null })
    expect(JSON.stringify(res.body)).not.toMatch(/relation|migration|social_content_drafts/) // internals stay in the server log
  })

  it('fails the whole request (500, a clear error) when every section fails — not a row of zeros', async () => {
    const agent = await admin()
    for (const table of Object.values(tables)) table.count.mockRejectedValueOnce(new Error('connection refused: postgres://velnora_app:secret@db:5432/velnora'))
    const res = await agent.get(URL)
    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
    expect(res.body.data).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toMatch(/postgres|velnora_app|secret|connection refused/)
  })
})
