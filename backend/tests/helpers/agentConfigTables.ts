import { vi } from 'vitest'

type Key = 'CUSTOMER_HANDLER' | 'LEAD_FINDER'
type Row = Record<string, unknown> & { id: string; agentKey: Key; version: number }
type VersionRow = Record<string, unknown> & { agentKey: Key; version: number }

/**
 * In-memory stand-in for the `agent_configs` / `agent_config_versions`
 * Prisma tables, spread into a test's mocked `prisma` object (like
 * adminAuthTables.ts). Just enough Prisma-shaped behavior for
 * agentConfig.service.ts's real code — including its compare-and-set
 * `updateMany` and nested `history.create` — to run unmodified.
 *
 * Every call is recorded by vi.fn, so tests can assert exactly WHICH
 * agent's row a code path asked for (e.g. that a Customer Handler request
 * never queries LEAD_FINDER).
 */
export function createAgentConfigTables() {
  const configs = new Map<Key, Row>()
  const versions: VersionRow[] = []
  let seq = 0

  const agentConfig = {
    findUnique: vi.fn(async ({ where }: { where: { agentKey: Key } }) => configs.get(where.agentKey) ?? null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> & { agentKey: Key; history?: { create: VersionRow } } }) => {
      if (configs.has(data.agentKey)) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      seq += 1
      const { history, ...fields } = data
      const row = { id: `cfg_${seq}`, createdAt: new Date(), updatedAt: new Date(), ...fields } as Row
      configs.set(row.agentKey, row)
      if (history) versions.push({ agentConfigId: row.id, createdAt: new Date(), ...history.create })
      return row
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: { agentKey: Key; version: number }; data: Record<string, unknown> }) => {
        const row = configs.get(where.agentKey)
        if (!row || row.version !== where.version) return { count: 0 }
        Object.assign(row, data, { updatedAt: new Date() })
        return { count: 1 }
      },
    ),
  }

  const agentConfigVersion = {
    findUnique: vi.fn(async ({ where }: { where: { agentKey_version: { agentKey: Key; version: number } } }) => {
      const { agentKey, version } = where.agentKey_version
      return versions.find((v) => v.agentKey === agentKey && v.version === version) ?? null
    }),
    findMany: vi.fn(async ({ where, take }: { where: { agentKey: Key }; take?: number }) =>
      versions
        .filter((v) => v.agentKey === where.agentKey)
        .sort((a, b) => b.version - a.version)
        .slice(0, take),
    ),
    create: vi.fn(async ({ data }: { data: VersionRow }) => {
      versions.push({ createdAt: new Date(), ...data })
      return data
    }),
  }

  return {
    agentConfig,
    agentConfigVersion,
    $transaction: vi.fn(async (fn: (tx: { agentConfig: typeof agentConfig; agentConfigVersion: typeof agentConfigVersion }) => unknown) =>
      fn({ agentConfig, agentConfigVersion }),
    ),
    /** Test inspection helpers. */
    peekConfig: (key: Key) => configs.get(key),
    peekVersions: (key: Key) => versions.filter((v) => v.agentKey === key),
    /** Overwrite a row directly (bypassing the service), e.g. to simulate an admin's saved edit. */
    setConfig(key: Key, fields: Record<string, unknown>) {
      const row = configs.get(key)
      if (row) Object.assign(row, fields)
      else {
        seq += 1
        configs.set(key, {
          id: `cfg_${seq}`,
          agentKey: key,
          displayName: key,
          rules: '',
          instructions: '',
          enabled: true,
          version: 1,
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...fields,
        } as Row)
      }
    },
    reset() {
      configs.clear()
      versions.length = 0
      agentConfig.findUnique.mockClear()
      agentConfig.create.mockClear()
      agentConfig.updateMany.mockClear()
    },
  }
}
