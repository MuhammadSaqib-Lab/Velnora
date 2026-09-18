import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createAdminAuthTables } from './helpers/adminAuthTables.js'

// Must be set before anything imports env.ts (config/env.ts parses
// process.env once at import time) — isolated in its own file for
// exactly that reason, mirroring adminLoginRateLimit.test.ts's pattern.
// This reproduces the real cross-site deployment (Vercel frontend,
// Render backend — two different registrable domains) that the
// original SameSite=Lax cookie broke live: login succeeded but the very
// next request silently looked unauthenticated, since browsers never
// attach a Lax cookie to a cross-site fetch at all.
process.env.NODE_ENV = 'production'
process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '1000'

vi.mock('../src/database/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), ...createAdminAuthTables() },
}))

const { prisma } = await import('../src/database/prisma.js')
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/utils/passwordHash.js')

const TEST_EMAIL = 'owner@velnora.com'
const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-9'

describe('admin session cookie in production (cross-site deployment)', () => {
  it('sets SameSite=None and Secure — required for the cookie to survive a genuinely cross-site fetch', async () => {
    ;(prisma as unknown as ReturnType<typeof createAdminAuthTables>).seedAdminUser({
      id: 'admin_test_1',
      email: TEST_EMAIL,
      passwordHash: await hashPassword(TEST_PASSWORD),
    })

    const app = createApp()
    const res = await request(app).post('/api/auth/admin/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD })

    expect(res.status).toBe(200)
    const setCookie = res.headers['set-cookie']
    const cookies: string[] = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
    const sessionCookie = cookies.find((c) => c.startsWith('velnora_admin_session='))

    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toMatch(/SameSite=None/i)
    expect(sessionCookie).toMatch(/Secure/i)
    expect(sessionCookie).toMatch(/HttpOnly/i)
  })
})
