import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    contactSubmission: { create: vi.fn() },
  },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')

const validPayload = {
  name: 'Jordan Ashworth',
  email: 'jordan@example.com',
  company: 'Example Co',
  phone: '',
  projectType: '',
  budgetRange: '',
  message: 'We need a new marketing site with better SEO.',
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores a valid submission and returns 201', async () => {
    vi.mocked(prisma.contactSubmission.create).mockResolvedValueOnce({
      id: 'c1',
      createdAt: new Date(),
    } as never)

    const app = createApp()
    const res = await request(app).post('/api/contact').send(validPayload)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ success: true })
    expect(prisma.contactSubmission.create).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(prisma.contactSubmission.create).mock.calls[0]?.[0]
    expect(callArgs?.data).toMatchObject({ name: 'Jordan Ashworth', email: 'jordan@example.com' })
  })

  it('rejects a payload missing required fields with 400 and field errors', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validPayload, name: '', message: '' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.errors).toHaveProperty('name')
    expect(res.body.errors).toHaveProperty('message')
    expect(prisma.contactSubmission.create).not.toHaveBeenCalled()
  })

  it('rejects an unsafe URL-shaped injection attempt in an unexpected field with 400', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validPayload, extraField: '<script>alert(1)</script>' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('never leaks database error detail when the database call fails', async () => {
    vi.mocked(prisma.contactSubmission.create).mockRejectedValueOnce(
      new Error('password authentication failed for user "postgres"'),
    )

    const app = createApp()
    const res = await request(app).post('/api/contact').send(validPayload)

    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
    expect(JSON.stringify(res.body)).not.toContain('password authentication')
  })
})
