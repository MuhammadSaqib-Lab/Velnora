import { vi } from 'vitest'

/**
 * A minimal in-memory stand-in for the `admin_users`/`admin_sessions`
 * Prisma tables, shared by every test that needs a real login flow to
 * exercise (adminAuth.test.ts, adminOverview.test.ts,
 * adminClientLeads.test.ts) without a live database. It's intentionally
 * simple — just enough Prisma-shaped behavior (findUnique/create/update/
 * deleteMany) for adminAuth.service.ts's actual code to run unmodified
 * against it, so these tests exercise the real hashing/session logic,
 * not a re-implementation of it.
 */
export function createAdminAuthTables() {
  const users = new Map<string, Record<string, unknown>>()
  const sessions = new Map<string, Record<string, unknown>>()
  let userSeq = 0
  let sessionSeq = 0

  const adminUser = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) return users.get(where.id) ?? null
      if (where.email) return [...users.values()].find((u) => u.email === where.email) ?? null
      return null
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      userSeq += 1
      const row = {
        id: `admin_user_${userSeq}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        ...data,
      }
      users.set(row.id, row)
      return row
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = users.get(where.id)
      if (!row) throw new Error('AdminUser not found')
      Object.assign(row, data, { updatedAt: new Date() })
      return row
    }),
  }

  const adminSession = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      sessionSeq += 1
      const row = {
        id: `admin_session_${sessionSeq}`,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        ...data,
      }
      sessions.set(row.tokenHash as string, row)
      return row
    }),
    findUnique: vi.fn(
      async ({ where, include }: { where: { tokenHash: string }; include?: { adminUser?: boolean } }) => {
        const row = sessions.get(where.tokenHash)
        if (!row) return null
        if (include?.adminUser) return { ...row, adminUser: users.get(row.adminUserId as string) ?? null }
        return row
      },
    ),
    update: vi.fn(async ({ where, data }: { where: { tokenHash: string }; data: Record<string, unknown> }) => {
      const row = sessions.get(where.tokenHash)
      if (!row) return null
      Object.assign(row, data)
      return row
    }),
    deleteMany: vi.fn(
      async ({
        where,
      }: {
        where: { tokenHash?: string; adminUserId?: string; expiresAt?: { lt: Date } }
      }) => {
        let count = 0
        for (const [key, row] of sessions) {
          const matchesToken = where.tokenHash === undefined || row.tokenHash === where.tokenHash
          const matchesUser = where.adminUserId === undefined || row.adminUserId === where.adminUserId
          const matchesExpiry = where.expiresAt === undefined || (row.expiresAt as Date) < where.expiresAt.lt
          if (matchesToken && matchesUser && matchesExpiry) {
            sessions.delete(key)
            count += 1
          }
        }
        return { count }
      },
    ),
  }

  return {
    adminUser,
    adminSession,
    /** Test setup helper — seeds an AdminUser row directly, bypassing bootstrap. */
    seedAdminUser(row: { id: string; email: string; passwordHash: string }) {
      users.set(row.id, { createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null, ...row })
    },
  }
}
