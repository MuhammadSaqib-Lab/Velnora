import { vi } from 'vitest'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * In-memory stand-in for the Client Portal's Prisma tables (`users`,
 * `client_sessions`, `projects`, `project_status_history`), spread into a
 * test's mocked `prisma` like adminAuthTables.ts. Deliberately a real,
 * faithful-enough implementation of the Prisma behaviors the services
 * rely on — scoped `where` filtering (including the `OR`/relation
 * `contains` search), nested `statusHistory.create`, the project-number
 * sequence, unique email (P2002), and the compare-and-set `updateMany` —
 * rather than canned return values, so the ownership/IDOR tests below
 * exercise the services' real query scoping instead of asserting against
 * mocks that agree with whatever was passed in.
 *
 * `include` returns the FULL related user row (passwordHash included),
 * stricter than real Prisma's `select`, so any DTO that spread a row
 * instead of listing fields would visibly leak in these tests.
 */
export function createClientPortalTables() {
  const users = new Map<string, Row>()
  const sessions = new Map<string, Row>()
  const projects: Row[] = []
  const history: Row[] = []
  let userSeq = 0
  let sessionSeq = 0
  let projectSeq = 0
  let historySeq = 0
  let tick = 0
  const now = () => new Date(Date.UTC(2026, 9, 1) + ++tick * 1000)
  const uniqueViolation = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })

  function contains(value: unknown, needle: string) {
    return typeof value === 'string' && value.toLowerCase().includes(needle.toLowerCase())
  }

  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') return (condition as Row[]).some((sub) => matches(row, sub))
      if (key === 'client') {
        const client = users.get(row.clientId)
        return !!client && matches(client, condition as Row)
      }
      if (condition && typeof condition === 'object' && 'contains' in (condition as Row)) {
        return contains(row[key], (condition as Row).contains)
      }
      return row[key] === condition
    })
  }

  function withRelations(row: Row, include?: Row) {
    if (!include) return row
    const out: Row = { ...row }
    if (include.client) out.client = users.get(row.clientId)
    if (include.statusHistory) {
      out.statusHistory = history.filter((h) => h.projectId === row.id).sort((a, b) => a.createdAt - b.createdAt)
    }
    return out
  }

  const user = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) return users.get(where.id) ?? null
      return [...users.values()].find((u) => u.email === where.email) ?? null
    }),
    create: vi.fn(async ({ data }: { data: Row }) => {
      if ([...users.values()].some((u) => u.email === data.email)) throw uniqueViolation()
      userSeq += 1
      // Prisma returns null (never undefined) for an unset optional column.
      const normalized = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === undefined ? null : v]))
      const row = { id: `user_${userSeq}`, createdAt: now(), updatedAt: now(), phone: null, company: null, lastLoginAt: null, ...normalized }
      users.set(row.id, row)
      return row
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
      const row = users.get(where.id)
      if (!row) throw new Error('User not found')
      return Object.assign(row, data, { updatedAt: now() })
    }),
  }

  const clientSession = {
    create: vi.fn(async ({ data }: { data: Row }) => {
      sessionSeq += 1
      const row = { id: `csess_${sessionSeq}`, createdAt: now(), lastUsedAt: now(), ...data }
      sessions.set(row.tokenHash, row)
      return row
    }),
    findUnique: vi.fn(async ({ where, include }: { where: { tokenHash: string }; include?: { user?: boolean } }) => {
      const row = sessions.get(where.tokenHash)
      if (!row) return null
      return include?.user ? { ...row, user: users.get(row.userId) ?? null } : row
    }),
    update: vi.fn(async ({ where, data }: { where: { tokenHash: string }; data: Row }) => {
      const row = sessions.get(where.tokenHash)
      return row ? Object.assign(row, data) : null
    }),
    deleteMany: vi.fn(async ({ where }: { where: { tokenHash?: string; userId?: string; expiresAt?: { lt: Date } } }) => {
      let count = 0
      for (const [key, row] of sessions) {
        const ok =
          (where.tokenHash === undefined || row.tokenHash === where.tokenHash) &&
          (where.userId === undefined || row.userId === where.userId) &&
          (where.expiresAt === undefined || row.expiresAt < where.expiresAt.lt)
        if (ok) {
          sessions.delete(key)
          count += 1
        }
      }
      return { count }
    }),
  }

  const project = {
    count: vi.fn(async ({ where }: { where?: Row } = {}) => projects.filter((p) => matches(p, where)).length),
    create: vi.fn(async ({ data }: { data: Row }) => {
      projectSeq += 1
      const { statusHistory, ...fields } = data
      const row: Row = {
        id: `proj_${projectSeq}`,
        projectSeq,
        websiteUrl: null,
        targetAudience: null,
        requiredFeatures: null,
        budgetRange: null,
        timeline: null,
        additionalNotes: null,
        status: 'NEW_REQUEST',
        createdAt: now(),
        updatedAt: now(),
        ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === undefined ? null : v])),
      }
      projects.push(row)
      if (statusHistory?.create) {
        historySeq += 1
        history.push({ id: `hist_${historySeq}`, projectId: row.id, createdAt: now(), message: null, ...statusHistory.create })
      }
      return row
    }),
    findMany: vi.fn(
      async ({ where, orderBy, skip = 0, take, include }: { where?: Row; orderBy?: Row; skip?: number; take?: number; include?: Row }) => {
        const [[field, dir]] = Object.entries(orderBy ?? { createdAt: 'desc' })
        const rows = projects
          .filter((p) => matches(p, where))
          .sort((a, b) => (dir === 'asc' ? 1 : -1) * (a[field] - b[field]))
          .slice(skip, take === undefined ? undefined : skip + take)
        return rows.map((r) => withRelations(r, include))
      },
    ),
    findFirst: vi.fn(async ({ where }: { where: Row }) => projects.find((p) => matches(p, where)) ?? null),
    findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: Row }) => {
      const row = projects.find((p) => p.id === where.id)
      return row ? withRelations(row, include) : null
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const rows = projects.filter((p) => matches(p, where))
      rows.forEach((r) => Object.assign(r, data, { updatedAt: now() }))
      return { count: rows.length }
    }),
  }

  const projectStatusHistory = {
    findMany: vi.fn(async ({ where, orderBy }: { where: Row; orderBy?: { createdAt: 'asc' | 'desc' } }) =>
      history
        .filter((h) => matches(h, where))
        .sort((a, b) => (orderBy?.createdAt === 'desc' ? -1 : 1) * (a.createdAt - b.createdAt)),
    ),
    create: vi.fn(async ({ data }: { data: Row }) => {
      historySeq += 1
      const row = { id: `hist_${historySeq}`, createdAt: now(), message: null, ...data }
      history.push(row)
      return row
    }),
  }

  const tables = { user, clientSession, project, projectStatusHistory }

  return {
    ...tables,
    $transaction: vi.fn(async (fn: (tx: typeof tables) => unknown) => fn(tables)),
    /** Test setup: insert a client account directly (bypassing sign-up). */
    seedClient(row: { id: string; email: string; passwordHash: string; name?: string; phone?: string | null; company?: string | null }) {
      users.set(row.id, { name: 'Test Client', role: 'USER', phone: null, company: null, lastLoginAt: null, createdAt: now(), updatedAt: now(), ...row })
    },
    /** Test setup: insert a project for a client directly. */
    seedProject(row: Row) {
      projectSeq += 1
      const created = {
        id: `proj_${projectSeq}`,
        projectSeq,
        projectName: 'Seeded Project',
        projectType: 'business-website',
        description: 'A seeded project used by tests.',
        websiteUrl: null,
        targetAudience: null,
        requiredFeatures: null,
        budgetRange: null,
        timeline: null,
        additionalNotes: null,
        status: 'NEW_REQUEST',
        createdAt: now(),
        updatedAt: now(),
        ...row,
      }
      projects.push(created)
      historySeq += 1
      history.push({ id: `hist_${historySeq}`, projectId: created.id, oldStatus: null, newStatus: created.status, message: 'Project submitted', changedBy: 'client', createdAt: now() })
      return created
    },
    peek: {
      users: () => [...users.values()],
      sessions: () => [...sessions.values()],
      projects: () => projects,
      history: (projectId: string) => history.filter((h) => h.projectId === projectId),
    },
    reset() {
      users.clear()
      sessions.clear()
      projects.length = 0
      history.length = 0
      userSeq = sessionSeq = projectSeq = historySeq = tick = 0
      for (const group of [user, clientSession, project, projectStatusHistory]) {
        for (const fn of Object.values(group)) (fn as ReturnType<typeof vi.fn>).mockClear()
      }
    },
  }
}
