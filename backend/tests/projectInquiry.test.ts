import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    projectInquiry: { create: vi.fn() },
  },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')

const validPayload = {
  name: 'Dana Whitlock',
  email: 'dana@example.com',
  company: '',
  phone: '',
  projectType: 'new-website',
  budgetRange: '1k-2.5k',
  message: 'Need to rebuild our outdated marketing site.',
  repoLink: '',
}

describe('POST /api/project-inquiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores a valid inquiry and returns 201', async () => {
    vi.mocked(prisma.projectInquiry.create).mockResolvedValueOnce({
      id: 'p1',
      createdAt: new Date(),
    } as never)

    const app = createApp()
    const res = await request(app).post('/api/project-inquiry').send(validPayload)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ success: true })
    expect(prisma.projectInquiry.create).toHaveBeenCalledTimes(1)
  })

  it('accepts a free-text budgetRange value — the field is open-ended, not a fixed enum', async () => {
    vi.mocked(prisma.projectInquiry.create).mockResolvedValueOnce({
      id: 'p2',
      createdAt: new Date(),
    } as never)

    const app = createApp()
    const res = await request(app)
      .post('/api/project-inquiry')
      .send({ ...validPayload, budgetRange: "Let's discuss" })

    expect(res.status).toBe(201)
    expect(prisma.projectInquiry.create).toHaveBeenCalledTimes(1)
  })

  it('rejects a budgetRange value over the max length with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/project-inquiry')
      .send({ ...validPayload, budgetRange: 'a'.repeat(101) })

    expect(res.status).toBe(400)
    expect(res.body.errors).toHaveProperty('budgetRange')
    expect(prisma.projectInquiry.create).not.toHaveBeenCalled()
  })

  it('rejects a javascript: repoLink with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/project-inquiry')
      .send({ ...validPayload, repoLink: 'javascript:alert(document.cookie)' })

    expect(res.status).toBe(400)
    expect(res.body.errors).toHaveProperty('repoLink')
  })

  it('accepts a valid repoLink and passes it through to storage', async () => {
    vi.mocked(prisma.projectInquiry.create).mockResolvedValueOnce({
      id: 'p2',
      createdAt: new Date(),
    } as never)

    const app = createApp()
    const res = await request(app)
      .post('/api/project-inquiry')
      .send({ ...validPayload, repoLink: 'https://github.com/example/repo' })

    expect(res.status).toBe(201)
    const callArgs = vi.mocked(prisma.projectInquiry.create).mock.calls[0]?.[0]
    expect(callArgs?.data.repoLink).toBe('https://github.com/example/repo')
  })
})
