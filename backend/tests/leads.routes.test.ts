import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.LEAD_FINDER_ADMIN_TOKEN = 'test-admin-token'
process.env.LEAD_FINDER_RATE_LIMIT_MAX = '1000' // this file sends more requests than the production default

const { findBusinesses, placesHealthCheck } = vi.hoisted(() => ({
  findBusinesses: vi.fn(),
  placesHealthCheck: vi.fn().mockResolvedValue(true),
}))
const { analyzeWebsite } = vi.hoisted(() => ({ analyzeWebsite: vi.fn() }))
const { generateOutreachEmail } = vi.hoisted(() => ({ generateOutreachEmail: vi.fn() }))
const { createDraft, isGmailReadyToDraft } = vi.hoisted(() => ({
  createDraft: vi.fn(),
  isGmailReadyToDraft: vi.fn(),
}))

vi.mock('../src/leadFinder/providers/GooglePlacesProvider.js', () => ({
  GooglePlacesProvider: class {
    findBusinesses = findBusinesses
    healthCheck = placesHealthCheck
  },
}))
vi.mock('../src/leadFinder/analysis/websiteAnalyzer.js', () => ({ analyzeWebsite }))
vi.mock('../src/leadFinder/email/generateEmail.js', async () => {
  const actual = await vi.importActual<typeof import('../src/leadFinder/email/generateEmail.js')>(
    '../src/leadFinder/email/generateEmail.js',
  )
  return { ...actual, generateOutreachEmail }
})
vi.mock('../src/leadFinder/gmail/GmailProvider.js', () => ({
  createDraft,
  isGmailReadyToDraft,
  generateAuthUrl: vi.fn(),
  exchangeCodeForRefreshToken: vi.fn(),
}))

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    lead: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')

const ADMIN_HEADER = { 'X-Admin-Token': 'test-admin-token' }

const GOOD_ANALYSIS = {
  fetched: true,
  statusCode: 200,
  title: 'Acme Dental',
  metaDescription: 'Family dentistry.',
  hasViewportMeta: true,
  hasCanonical: true,
  hasStructuredData: true,
  h1Count: 1,
  imgTotal: 5,
  imgWithAlt: 5,
  hasContactCta: true,
  hasChatOrBookingWidget: true,
  robotsTxtFound: true,
  sitemapFound: true,
  contactEmail: 'hello@acmedental.example',
}

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead_1',
    businessName: 'Acme Dental',
    category: 'Dentist',
    website: null,
    domain: null,
    email: null,
    phone: null,
    location: 'Lahore, Pakistan',
    source: 'Google Places',
    sourceUrl: 'https://maps.google.com/?cid=1',
    opportunityTypes: ['NO_WEBSITE'],
    opportunityScore: 30,
    priority: 'LOW',
    status: 'RESEARCHED',
    analysis: { website: null },
    evidence: { NO_WEBSITE: { evidence: ['No official website was found in the available research.'], source: 'x' } },
    emailSubject: null,
    emailBody: null,
    gmailDraftId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('POST /api/leads/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    placesHealthCheck.mockResolvedValue(true)
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.lead.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.lead.findMany).mockResolvedValue([])
  })

  it('researches a business with no website and creates a RESEARCHED lead', async () => {
    findBusinesses.mockResolvedValue([
      {
        businessName: 'Acme Dental',
        category: 'Dentist',
        location: 'Lahore, Pakistan',
        sourceUrl: 'https://maps.google.com/?cid=1',
        source: 'Google Places',
      },
    ])
    vi.mocked(prisma.lead.create).mockResolvedValueOnce(leadRow() as never)

    const app = createApp()
    const res = await request(app)
      .post('/api/leads/search')
      .set(ADMIN_HEADER)
      .send({ industry: 'dentists', location: 'Lahore' })

    expect(res.status).toBe(200)
    expect(res.body.data.leads).toHaveLength(1)
    expect(prisma.lead.create).toHaveBeenCalledTimes(1)
    const createArgs = vi.mocked(prisma.lead.create).mock.calls[0]?.[0]
    expect(createArgs?.data).toMatchObject({ businessName: 'Acme Dental', status: 'RESEARCHED' })
    expect(analyzeWebsite).not.toHaveBeenCalled() // no website field -> never fetched
  })

  it('researches a business with a good website and finds no opportunities, so nothing is persisted', async () => {
    findBusinesses.mockResolvedValue([
      {
        businessName: 'Great Site Co',
        category: 'Software Company',
        website: 'https://greatsite.example',
        sourceUrl: 'https://maps.google.com/?cid=2',
        source: 'Google Places',
      },
    ])
    analyzeWebsite.mockResolvedValue(GOOD_ANALYSIS)

    const app = createApp()
    const res = await request(app)
      .post('/api/leads/search')
      .set(ADMIN_HEADER)
      .send({ industry: 'software', location: 'Lahore' })

    expect(res.status).toBe(200)
    expect(res.body.data.leads).toHaveLength(0)
    expect(prisma.lead.create).not.toHaveBeenCalled()
  })

  it('filters results by opportunityTypes and minScore', async () => {
    findBusinesses.mockResolvedValue([
      { businessName: 'No Site Biz', category: 'Dentist', sourceUrl: 'https://maps.google.com/?cid=3', source: 'Google Places' },
    ])
    vi.mocked(prisma.lead.create).mockResolvedValue(leadRow() as never)

    const app = createApp()
    const res = await request(app)
      .post('/api/leads/search')
      .set(ADMIN_HEADER)
      .send({ industry: 'dentists', location: 'Lahore', opportunityTypes: ['WEAK_SEO'], minScore: 90 })

    // NO_WEBSITE-only result doesn't match a WEAK_SEO filter.
    expect(res.body.data.leads).toHaveLength(0)
  })

  it('updates (enriches) an existing lead instead of creating a duplicate', async () => {
    findBusinesses.mockResolvedValue([
      { businessName: 'Acme Dental', category: 'Dentist', sourceUrl: 'https://maps.google.com/?cid=1', source: 'Google Places' },
    ])
    vi.mocked(prisma.lead.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      { id: 'existing_1', businessName: 'Acme Dental', email: 'kept@acme.example', phone: null, website: null },
    ] as never)
    vi.mocked(prisma.lead.update).mockResolvedValue(leadRow({ id: 'existing_1' }) as never)

    const app = createApp()
    const res = await request(app)
      .post('/api/leads/search')
      .set(ADMIN_HEADER)
      .send({ industry: 'dentists', location: 'Lahore' })

    expect(res.status).toBe(200)
    expect(prisma.lead.create).not.toHaveBeenCalled()
    expect(prisma.lead.update).toHaveBeenCalledTimes(1)
    const updateArgs = vi.mocked(prisma.lead.update).mock.calls[0]?.[0]
    expect(updateArgs?.where).toEqual({ id: 'existing_1' })
    // Enrichment: the email already on file is preserved, not blanked.
    expect(updateArgs?.data.email).toBe('kept@acme.example')
  })

  it('returns 503 when the search provider is not configured', async () => {
    placesHealthCheck.mockResolvedValue(false)
    const app = createApp()
    const res = await request(app)
      .post('/api/leads/search')
      .set(ADMIN_HEADER)
      .send({ industry: 'dentists', location: 'Lahore' })
    expect(res.status).toBe(503)
    expect(findBusinesses).not.toHaveBeenCalled()
  })

  it('returns a safe 502 when the search provider call fails, never leaking the raw error', async () => {
    findBusinesses.mockRejectedValue(new Error('Places API request failed with status 403: key restricted to IP 1.2.3.4'))
    const app = createApp()
    const res = await request(app)
      .post('/api/leads/search')
      .set(ADMIN_HEADER)
      .send({ industry: 'dentists', location: 'Lahore' })
    expect(res.status).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('1.2.3.4')
  })

  it('rejects a missing industry with 400 validation errors', async () => {
    const app = createApp()
    const res = await request(app).post('/api/leads/search').set(ADMIN_HEADER).send({ location: 'Lahore' })
    expect(res.status).toBe(400)
    expect(res.body.errors).toHaveProperty('industry')
    expect(findBusinesses).not.toHaveBeenCalled()
  })

  it('returns a safe 500 when saving research results fails at the database, never leaking the error', async () => {
    findBusinesses.mockResolvedValue([
      { businessName: 'Acme Dental', category: 'Dentist', sourceUrl: 'https://maps.google.com/?cid=1', source: 'Google Places' },
    ])
    vi.mocked(prisma.lead.create).mockRejectedValue(new Error('password authentication failed for user "velnora_app"'))

    const app = createApp()
    const res = await request(app)
      .post('/api/leads/search')
      .set(ADMIN_HEADER)
      .send({ industry: 'dentists', location: 'Lahore' })

    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('password authentication')
  })
})

describe('GET /api/leads and /api/leads/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists leads with pagination metadata', async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([leadRow()] as never)
    vi.mocked(prisma.lead.count).mockResolvedValue(1)

    const app = createApp()
    const res = await request(app).get('/api/leads').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.leads).toHaveLength(1)
  })

  it('rejects an invalid status filter with 400', async () => {
    const app = createApp()
    const res = await request(app).get('/api/leads?status=NOT_A_REAL_STATUS').set(ADMIN_HEADER)
    expect(res.status).toBe(400)
  })

  it('defaults to score_desc sort, unchanged from the pre-Phase-5 hardcoded behavior', async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.lead.count).mockResolvedValue(0)

    const app = createApp()
    await request(app).get('/api/leads').set(ADMIN_HEADER)

    const call = vi.mocked(prisma.lead.findMany).mock.calls[0]?.[0]
    expect(call?.orderBy).toEqual({ opportunityScore: 'desc' })
  })

  it('supports search across businessName/domain/email/location', async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.lead.count).mockResolvedValue(0)

    const app = createApp()
    const res = await request(app).get('/api/leads?search=acme').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.lead.findMany).mock.calls[0]?.[0]
    expect(call?.where?.OR).toHaveLength(4)
  })

  it('supports filtering by priority, opportunityTypes, hasEmail, and hasWebsite', async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.lead.count).mockResolvedValue(0)

    const app = createApp()
    const res = await request(app)
      .get('/api/leads?priority=STRONG&opportunityTypes=WEAK_SEO&hasEmail=true&hasWebsite=false&sort=newest')
      .set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.lead.findMany).mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({
      priority: 'STRONG',
      opportunityTypes: { hasSome: ['WEAK_SEO'] },
      email: { not: null },
      website: null,
    })
    expect(call?.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('rejects an invalid sort value with 400', async () => {
    const app = createApp()
    const res = await request(app).get('/api/leads?sort=random_order').set(ADMIN_HEADER)
    expect(res.status).toBe(400)
  })

  it('returns a safe 500 when listing fails at the database, never leaking the underlying error', async () => {
    vi.mocked(prisma.lead.findMany).mockRejectedValue(
      new Error('Authentication failed against database server, the provided database credentials for `velnora_app` are not valid.'),
    )
    vi.mocked(prisma.lead.count).mockResolvedValue(0)

    const app = createApp()
    const res = await request(app).get('/api/leads').set(ADMIN_HEADER)

    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
    expect(JSON.stringify(res.body)).not.toContain('credentials')
  })

  it('returns a lead by id, including a reconstructed, explainable score breakdown', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(leadRow() as never)
    const app = createApp()
    const res = await request(app).get('/api/leads/lead_1').set(ADMIN_HEADER)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('lead_1')
    expect(res.body.data.scoreBreakdown).toMatchObject({ score: 30, priority: 'LOW' })
    expect(res.body.data.scoreBreakdown.reasons.join(' ')).toContain('NO_WEBSITE')
  })

  it('returns 404 for an unknown lead id', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null)
    const app = createApp()
    const res = await request(app).get('/api/leads/does-not-exist').set(ADMIN_HEADER)
    expect(res.status).toBe(404)
  })

  it('returns a safe 500 when the lookup itself fails at the database, never leaking the underlying error', async () => {
    vi.mocked(prisma.lead.findUnique).mockRejectedValue(
      new Error('Authentication failed against database server, the provided database credentials for `velnora_app` are not valid.'),
    )
    const app = createApp()
    const res = await request(app).get('/api/leads/lead_1').set(ADMIN_HEADER)
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('velnora_app')
  })
})

describe('POST /api/leads/:id/generate-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates and saves an email for a lead with a verified email', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(leadRow({ email: 'owner@acme.example' }) as never)
    generateOutreachEmail.mockResolvedValue({ subject: 'A practical idea', body: 'Hello Acme Dental team...' })
    vi.mocked(prisma.lead.update).mockResolvedValue(
      leadRow({ email: 'owner@acme.example', emailSubject: 'A practical idea', emailBody: 'Hello...' }) as never,
    )

    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/generate-email').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.data.emailSubject).toBe('A practical idea')
  })

  it('refuses with a clear NO_CONTACT_EMAIL message when the lead has no verified email — never invents one', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(leadRow({ email: null }) as never)
    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/generate-email').set(ADMIN_HEADER)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/NO_CONTACT_EMAIL/)
    expect(generateOutreachEmail).not.toHaveBeenCalled()
  })

  it('returns a safe error when the AI provider is not configured', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(leadRow({ email: 'owner@acme.example' }) as never)
    const { EmailGenerationError } = await import('../src/leadFinder/email/generateEmail.js')
    generateOutreachEmail.mockRejectedValue(new EmailGenerationError('ANTHROPIC_API_KEY is not configured'))

    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/generate-email').set(ADMIN_HEADER)
    expect(res.status).toBe(502)
    expect(prisma.lead.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/leads/:id/create-draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isGmailReadyToDraft.mockReturnValue(true)
  })

  it('creates a Gmail draft, sets EMAIL_DRAFTED, and the response never claims the email was sent', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(
      leadRow({ email: 'owner@acme.example', emailSubject: 'Hi', emailBody: 'Body' }) as never,
    )
    createDraft.mockResolvedValue('draft_abc')
    vi.mocked(prisma.lead.update).mockResolvedValue(
      leadRow({ status: 'EMAIL_DRAFTED', gmailDraftId: 'draft_abc' }) as never,
    )

    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/create-draft').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(res.body.data.gmailDraftId).toBe('draft_abc')
    expect(res.body.data.status).toBe('EMAIL_DRAFTED')
    // The endpoint clearly states nothing is auto-sent, and never claims
    // the email itself has already been sent as a completed action.
    expect(res.body.message.toLowerCase()).toContain('nothing is sent automatically')
    expect(res.body.message.toLowerCase()).toContain('manually')
    expect(res.body.message.toLowerCase()).not.toMatch(/\bemail (has been|was) sent\b/)
  })

  it('refuses when the lead has no verified email', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(leadRow({ email: null }) as never)
    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/create-draft').set(ADMIN_HEADER)
    expect(res.status).toBe(400)
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('refuses when no email has been generated yet', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(
      leadRow({ email: 'owner@acme.example', emailSubject: null, emailBody: null }) as never,
    )
    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/create-draft').set(ADMIN_HEADER)
    expect(res.status).toBe(400)
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('refuses to create a second draft when one already exists (no force flag)', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(
      leadRow({ email: 'owner@acme.example', emailSubject: 'Hi', emailBody: 'Body', gmailDraftId: 'draft_existing' }) as never,
    )
    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/create-draft').set(ADMIN_HEADER)
    expect(res.status).toBe(409)
    expect(res.body.message).toContain('draft_existing')
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('creates another draft when force:true is explicitly passed, even if one already exists', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(
      leadRow({ email: 'owner@acme.example', emailSubject: 'Hi', emailBody: 'Body', gmailDraftId: 'draft_existing' }) as never,
    )
    createDraft.mockResolvedValue('draft_new')
    vi.mocked(prisma.lead.update).mockResolvedValue(leadRow({ gmailDraftId: 'draft_new' }) as never)

    const app = createApp()
    const res = await request(app)
      .post('/api/leads/lead_1/create-draft')
      .set(ADMIN_HEADER)
      .send({ force: true })

    expect(res.status).toBe(200)
    expect(createDraft).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-boolean force value with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/leads/lead_1/create-draft')
      .set(ADMIN_HEADER)
      .send({ force: 'yes please' })
    expect(res.status).toBe(400)
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('returns 503 when Gmail is not configured', async () => {
    isGmailReadyToDraft.mockReturnValue(false)
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(
      leadRow({ email: 'owner@acme.example', emailSubject: 'Hi', emailBody: 'Body' }) as never,
    )
    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/create-draft').set(ADMIN_HEADER)
    expect(res.status).toBe(503)
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('returns a safe 502 when Gmail draft creation itself fails (e.g. OAuth failure), never a fabricated success', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(
      leadRow({ email: 'owner@acme.example', emailSubject: 'Hi', emailBody: 'Body' }) as never,
    )
    createDraft.mockRejectedValue(new Error('invalid_grant: Token has been revoked'))

    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/create-draft').set(ADMIN_HEADER)

    expect(res.status).toBe(502)
    expect(res.body.success).toBe(false)
    expect(prisma.lead.update).not.toHaveBeenCalled()
    expect(JSON.stringify(res.body)).not.toContain('invalid_grant')
  })
})

describe('PATCH /api/leads/:id/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates status to a human-decision value', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(leadRow() as never)
    vi.mocked(prisma.lead.update).mockResolvedValue(leadRow({ status: 'CONTACTED' }) as never)

    const app = createApp()
    const res = await request(app).patch('/api/leads/lead_1/status').set(ADMIN_HEADER).send({ status: 'CONTACTED' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('CONTACTED')
  })

  it('rejects a pipeline-managed status value (e.g. EMAIL_DRAFTED) — only the pipeline itself sets those', async () => {
    const app = createApp()
    const res = await request(app).patch('/api/leads/lead_1/status').set(ADMIN_HEADER).send({ status: 'EMAIL_DRAFTED' })
    expect(res.status).toBe(400)
    expect(prisma.lead.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/leads/:id/analyze', () => {
  it('re-researches an existing lead and refreshes its score', async () => {
    vi.clearAllMocks()
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(leadRow({ website: 'https://acmedental.example' }) as never)
    analyzeWebsite.mockResolvedValue({ ...GOOD_ANALYSIS, hasViewportMeta: false })
    vi.mocked(prisma.lead.update).mockResolvedValue(leadRow({ opportunityTypes: ['POOR_MOBILE'] }) as never)

    const app = createApp()
    const res = await request(app).post('/api/leads/lead_1/analyze').set(ADMIN_HEADER)

    expect(res.status).toBe(200)
    expect(analyzeWebsite).toHaveBeenCalledWith('https://acmedental.example')
  })
})
