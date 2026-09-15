import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

// Set a small, deterministic limit before anything imports env.ts, so
// this test doesn't need to fire 10+ real requests to prove the
// middleware works (same pattern as tests/rateLimit.test.ts).
process.env.AI_CHAT_RATE_LIMIT_MAX = '2'
process.env.AI_CHAT_RATE_LIMIT_WINDOW_MS = '60000'

vi.mock('../src/ai/providers/AnthropicProvider.js', () => ({
  AnthropicProvider: class {
    generateResponse = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Hello!' }],
      stopReason: 'end_turn',
    })
    healthCheck = vi.fn().mockResolvedValue(true)
  },
}))

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    aIConversation: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'conv_1',
        sessionId: '22222222-2222-4222-8222-222222222222',
        status: 'ACTIVE',
      }),
      update: vi.fn(),
    },
    aIMessage: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    qualifiedLead: { create: vi.fn() },
  },
}))

const { createApp } = await import('../src/app.js')

describe('rate limiting on POST /api/ai/chat', () => {
  it('allows requests up to the configured max, then returns 429', async () => {
    const app = createApp()

    const first = await request(app).post('/api/ai/chat').send({ message: 'hello' })
    const second = await request(app).post('/api/ai/chat').send({ message: 'hello again' })
    const third = await request(app).post('/api/ai/chat').send({ message: 'one more' })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect(third.body).toMatchObject({ success: false })
  })
})
