import { vi } from 'vitest'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * In-memory stand-ins for the Digital Marketing Prisma tables, spread into a
 * test's mocked `prisma` (like clientPortalTables.ts). A small but real
 * implementation of the Prisma behaviors the services rely on — `where`
 * (equality, in, not, lt/lte/gt/gte, contains), orderBy, skip/take, nested
 * creates (findings, revisions), `include`, cascading deletes, SetNull on
 * campaign delete, and unique constraints (P2002) — instead of canned
 * results, so persistence, filtering and state-transition tests exercise the
 * services' real queries.
 */
export function createMarketingTables() {
  let tick = 0
  // Anchored to the real clock (monotonic, 1 s apart) so time-based logic such as stale-task
  // reconciliation sees realistic ages instead of rows that look days old.
  const base = Date.now()
  const now = () => new Date(base + ++tick * 1000)
  const seq: Record<string, number> = {}
  // One counter per table, shared by direct creates and nested creates, so ids never collide.
  const nextId = (name: string) => (seq[name] = (seq[name] ?? 0) + 1)
  const uniqueViolation = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })

  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, cond]) => {
      const value = row[key]
      if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
        const c = cond as Row
        if ('in' in c && !(c.in as unknown[]).includes(value)) return false
        if ('not' in c && value === c.not) return false
        if ('lt' in c && !(value !== null && value !== undefined && value < c.lt)) return false
        if ('lte' in c && !(value !== null && value !== undefined && value <= c.lte)) return false
        if ('gt' in c && !(value !== null && value !== undefined && value > c.gt)) return false
        if ('gte' in c && !(value !== null && value !== undefined && value >= c.gte)) return false
        if ('contains' in c && !(typeof value === 'string' && value.toLowerCase().includes(String(c.contains).toLowerCase()))) return false
        return true
      }
      return value === cond
    })
  }

  interface TableOptions {
    name: string
    defaults?: () => Row
    unique?: string[]
    /** nested relation fields in create data → how to create children */
    nested?: Record<string, (parentId: string, items: Row[]) => void>
    /** called after a row is deleted */
    onDelete?: (id: string) => void
    /** attach relations for `include` */
    include?: (row: Row, include: Row) => Row
  }

  function makeTable(opts: TableOptions) {
    const rows: Row[] = []
    const findOneIndex = (where: Row) => rows.findIndex((r) => matches(r, where))

    const table = {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const nested: Array<[string, Row[]]> = []
        const flat: Row = {}
        for (const [k, v] of Object.entries(data)) {
          if (opts.nested?.[k] && v && typeof v === 'object' && 'create' in (v as Row)) {
            const items = (v as Row).create
            nested.push([k, Array.isArray(items) ? items : [items]])
          } else flat[k] = v === undefined ? undefined : v
        }
        for (const key of opts.unique ?? []) {
          if (flat[key] !== undefined && flat[key] !== null && rows.some((r) => r[key] === flat[key])) throw uniqueViolation()
        }
        seq[opts.name] = (seq[opts.name] ?? 0) + 1
        const row: Row = { id: `${opts.name}_${seq[opts.name]}`, createdAt: now(), updatedAt: now(), ...opts.defaults?.() }
        for (const [k, v] of Object.entries(flat)) if (v !== undefined) row[k] = v
        // Prisma returns null (never undefined) for unset optional columns.
        for (const [k, v] of Object.entries(row)) if (v === undefined) row[k] = null
        rows.push(row)
        for (const [k, items] of nested) opts.nested![k]!(row.id, items)
        return row
      }),
      findUnique: vi.fn(async ({ where, include }: { where: Row; include?: Row }) => {
        const i = findOneIndex(where)
        return i === -1 ? null : include && opts.include ? opts.include(rows[i]!, include) : rows[i]!
      }),
      findFirst: vi.fn(async ({ where }: { where?: Row } = {}) => rows.find((r) => matches(r, where)) ?? null),
      findMany: vi.fn(async ({ where, orderBy, skip = 0, take, include }: { where?: Row; orderBy?: Row; skip?: number; take?: number; include?: Row } = {}) => {
        let list = rows.filter((r) => matches(r, where))
        if (orderBy) {
          const [[field, dir]] = Object.entries(orderBy)
          list = [...list].sort((a, b) => {
            const av = a[field] instanceof Date ? a[field].getTime() : a[field]
            const bv = b[field] instanceof Date ? b[field].getTime() : b[field]
            return (dir === 'asc' ? 1 : -1) * (av < bv ? -1 : av > bv ? 1 : 0)
          })
        }
        list = list.slice(skip, take === undefined ? undefined : skip + take)
        return list.map((r) => (include && opts.include ? opts.include(r, include) : r))
      }),
      count: vi.fn(async ({ where }: { where?: Row } = {}) => rows.filter((r) => matches(r, where)).length),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const i = findOneIndex(where)
        if (i === -1) throw new Error(`${opts.name} not found`)
        const next = { ...rows[i]! }
        for (const [k, v] of Object.entries(data)) next[k] = v
        next.updatedAt = now()
        rows[i] = next
        return next
      }),
      updateMany: vi.fn(async ({ where, data }: { where?: Row; data: Row }) => {
        let count = 0
        rows.forEach((r, i) => {
          if (!matches(r, where)) return
          rows[i] = { ...r, ...data, updatedAt: now() }
          count += 1
        })
        return { count }
      }),
      delete: vi.fn(async ({ where }: { where: Row }) => {
        const i = findOneIndex(where)
        if (i === -1) throw new Error(`${opts.name} not found`)
        const [removed] = rows.splice(i, 1)
        opts.onDelete?.(removed!.id)
        return removed
      }),
    }
    return { table, rows }
  }

  const findings = makeTable({ name: 'finding' })
  const revisions = makeTable({ name: 'revision' })
  const audits = makeTable({
    name: 'audit',
    defaults: () => ({ kind: 'OWN', summary: {}, finalUrl: null, taskId: null }),
    nested: {
      findings: (auditId, items) => items.forEach((item) => findings.rows.push({ id: `finding_${nextId('finding')}`, auditId, evidence: null, result: null, pageUrl: null, impact: null, effort: null, confidence: null, ...item })),
    },
    include: (row, inc) => (inc.findings ? { ...row, findings: findings.rows.filter((f) => f.auditId === row.id) } : row),
    onDelete: (id) => {
      for (let i = findings.rows.length - 1; i >= 0; i--) if (findings.rows[i]!.auditId === id) findings.rows.splice(i, 1)
    },
  })
  const drafts = makeTable({
    name: 'draft',
    defaults: () => ({ status: 'DRAFT', hashtags: [], origin: 'AI', plannedFor: null, campaignId: null, sourceDraftId: null, approvedBy: null, approvedAt: null, updatedBy: null }),
    nested: {
      revisions: (draftId, items) => items.forEach((item) => revisions.rows.push({ id: `revision_${nextId('revision')}`, draftId, createdAt: now(), title: null, hashtags: [], ...item })),
    },
    onDelete: (id) => {
      for (let i = revisions.rows.length - 1; i >= 0; i--) if (revisions.rows[i]!.draftId === id) revisions.rows.splice(i, 1)
    },
  })
  const campaigns = makeTable({
    name: 'campaign',
    defaults: () => ({ status: 'DRAFT', activities: [] }),
    onDelete: (id) => drafts.rows.forEach((d, i) => d.campaignId === id && (drafts.rows[i] = { ...d, campaignId: null })),
  })
  const strategies = makeTable({ name: 'strategy', defaults: () => ({ kind: 'STRATEGY', status: 'DRAFT', evidence: [], items: [], kpis: [], origin: 'AI', approvedBy: null, approvedAt: null }) })
  const tasks = makeTable({ name: 'task', unique: ['idempotencyKey'], defaults: () => ({ status: 'PENDING', input: {}, resultIds: [], retryOfId: null, startedAt: null, completedAt: null, errorCode: null, errorMessage: null }) })
  const logs = makeTable({ name: 'log' })

  return {
    marketingTask: tasks.table,
    seoAudit: audits.table,
    seoAuditFinding: findings.table,
    socialContentDraft: drafts.table,
    socialDraftRevision: revisions.table,
    marketingStrategy: strategies.table,
    marketingCampaign: campaigns.table,
    marketingAuditLog: logs.table,
    peek: {
      tasks: () => tasks.rows,
      audits: () => audits.rows,
      findings: (auditId?: string) => findings.rows.filter((f) => !auditId || f.auditId === auditId),
      drafts: () => drafts.rows,
      revisions: (draftId: string) => revisions.rows.filter((r) => r.draftId === draftId),
      strategies: () => strategies.rows,
      campaigns: () => campaigns.rows,
      logs: () => logs.rows,
    },
    reset() {
      for (const t of [tasks, audits, findings, drafts, revisions, campaigns, strategies, logs]) {
        t.rows.length = 0
        for (const fn of Object.values(t.table)) (fn as ReturnType<typeof vi.fn>).mockClear()
      }
      tick = 0
      for (const k of Object.keys(seq)) delete seq[k]
    },
  }
}
