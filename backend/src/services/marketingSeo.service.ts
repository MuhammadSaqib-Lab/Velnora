import type { Prisma } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { generateStructured } from '../marketing/ai.js'
import { MarketingTaskError } from '../marketing/errors.js'
import { marketingPlanTool, normalizePlan } from '../marketing/generation.js'
import { buildFindings, summarize, type FindingDraft } from '../marketing/seo/checks.js'
import { crawlSite } from '../marketing/seo/crawler.js'
import { buildMarkdownReport, compareFindings, sortFindings, type StoredFinding } from '../marketing/seo/report.js'
import { sanitizeLine } from '../marketing/text.js'
import { AppError } from '../utils/AppError.js'
import { normalizeAuditUrl, type SeoAuditCreateInput, type SeoPlanInput } from '../validators/marketing.validator.js'
import { recordMarketingAudit } from './marketingAudit.service.js'
import { executeTask } from './marketingTask.service.js'

type FindingRow = {
  id: string
  checkKey: string
  category: string
  label: StoredFinding['label']
  result: string | null
  title: string
  detail: string
  evidence: unknown
  pageUrl: string | null
  impact: number | null
  effort: number | null
  confidence: string | null
}

type AuditRow = {
  id: string
  taskId: string | null
  url: string
  finalUrl: string | null
  domain: string
  kind: string
  summary: unknown
  createdBy: string
  createdAt: Date
}

function dbError(message: string, cause: unknown): AppError {
  return new AppError(500, message, undefined, { cause })
}

function toAuditDto(row: AuditRow) {
  return {
    id: row.id,
    url: row.url,
    finalUrl: row.finalUrl,
    domain: row.domain,
    kind: row.kind,
    summary: row.summary,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  }
}

function toFindingDto(row: FindingRow) {
  return {
    id: row.id,
    checkKey: row.checkKey,
    category: row.category,
    label: row.label,
    result: row.result,
    title: row.title,
    detail: row.detail,
    evidence: row.evidence ?? null,
    pageUrl: row.pageUrl,
    impact: row.impact,
    effort: row.effort,
    confidence: row.confidence,
  }
}

// ──────────────────────────────── audits ─────────────────────────────────────

export function startSeoAudit(input: SeoAuditCreateInput, actor: string, idempotencyKey?: string, retryOfId?: string) {
  const normalized = normalizeAuditUrl(input.url)
  if (!normalized.ok) throw new AppError(400, normalized.message)

  return executeTask({
    type: 'SEO_AUDIT',
    input: { url: normalized.url, kind: input.kind, includePageSpeed: input.includePageSpeed },
    actor,
    idempotencyKey,
    retryOfId,
    run: async (ctx) => {
      // Re-validated here (not just at the route) so a retried or replayed task can never skip the check.
      const target = normalizeAuditUrl(normalized.url)
      if (!target.ok) throw new MarketingTaskError('INVALID_URL', target.message)

      const crawl = await crawlSite(target.url, { kind: input.kind, includePageSpeed: input.includePageSpeed })
      if (!crawl) {
        throw new MarketingTaskError(
          'FETCH_FAILED',
          'The website could not be fetched. It may be down, too slow or too large, blocking automated requests, or not a public address.',
        )
      }

      const findings: FindingDraft[] = buildFindings(crawl)
      const { labels, results } = summarize(findings)
      const summary = {
        pagesCrawled: 1 + crawl.pages.length,
        linksChecked: crawl.linkChecks.length,
        truncated: crawl.truncated,
        labels,
        results,
        dataSources: {
          crawl: 'AVAILABLE',
          pageSpeed: crawl.pageSpeed === 'SKIPPED' ? 'SKIPPED' : crawl.pageSpeed === null ? 'UNAVAILABLE' : 'AVAILABLE',
          searchConsole: 'NOT_CONNECTED',
          analytics: 'NOT_CONNECTED',
          keywordProvider: 'NOT_CONNECTED',
          backlinks: 'NOT_CONNECTED',
        },
      }

      let audit
      try {
        audit = await prisma.seoAudit.create({
          data: {
            taskId: ctx.taskId,
            url: target.url,
            finalUrl: crawl.main.url,
            domain: target.domain,
            kind: input.kind,
            summary: summary as unknown as Prisma.InputJsonValue,
            createdBy: actor,
            findings: {
              create: findings.map((f) => ({
                checkKey: f.checkKey,
                category: f.category,
                label: f.label,
                result: f.result ?? null,
                title: f.title,
                detail: f.detail,
                evidence: (f.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
                pageUrl: f.pageUrl ?? null,
                impact: f.impact ?? null,
                effort: f.effort ?? null,
                confidence: f.confidence ?? null,
              })),
            },
          },
        })
      } catch (error) {
        throw dbError('A database error occurred while saving the audit.', error)
      }
      return { resultType: 'SEO_AUDIT', resultIds: [audit.id] }
    },
  })
}

export async function listSeoAudits(query: { domain?: string; page: number; pageSize: number }) {
  const where: Prisma.SeoAuditWhereInput = query.domain ? { domain: query.domain.toLowerCase().replace(/^www\./, '') } : {}
  try {
    const [rows, total] = await Promise.all([
      prisma.seoAudit.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.seoAudit.count({ where }),
    ])
    return { audits: (rows as AuditRow[]).map(toAuditDto), total, page: query.page, pageSize: query.pageSize }
  } catch (error) {
    throw dbError('A database error occurred while listing audits.', error)
  }
}

async function loadAudit(id: string) {
  let row
  try {
    row = await prisma.seoAudit.findUnique({ where: { id }, include: { findings: true } })
  } catch (error) {
    throw dbError('A database error occurred while loading the audit.', error)
  }
  if (!row) throw new AppError(404, 'Audit not found.')
  return row as AuditRow & { findings: FindingRow[] }
}

export async function getSeoAudit(id: string) {
  const row = await loadAudit(id)
  return { ...toAuditDto(row), findings: sortFindings(row.findings.map(toFindingDto) as unknown as StoredFinding[]) }
}

export async function deleteSeoAudit(id: string, actor: string) {
  const row = await loadAudit(id)
  try {
    await prisma.seoAudit.delete({ where: { id } })
  } catch (error) {
    throw dbError('A database error occurred while deleting the audit.', error)
  }
  await recordMarketingAudit(actor, 'seo_audit.deleted', 'SeoAudit', id, { domain: row.domain })
}

export async function exportSeoAudit(id: string, format: 'md' | 'json') {
  const row = await loadAudit(id)
  const findings = sortFindings(row.findings.map(toFindingDto) as unknown as StoredFinding[])
  const filename = `seo-audit-${row.domain.replace(/[^a-z0-9.-]/gi, '-')}-${row.createdAt.toISOString().slice(0, 10)}`
  if (format === 'json') {
    return { filename: `${filename}.json`, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ audit: toAuditDto(row), findings }, null, 2) }
  }
  return {
    filename: `${filename}.md`,
    contentType: 'text/markdown; charset=utf-8',
    body: buildMarkdownReport({ id: row.id, url: row.url, finalUrl: row.finalUrl, domain: row.domain, kind: row.kind, createdAt: row.createdAt, summary: row.summary }, findings),
  }
}

export async function compareSeoAudits(baseId: string, otherId: string) {
  const [base, other] = await Promise.all([loadAudit(baseId), loadAudit(otherId)])
  return {
    base: toAuditDto(base),
    other: toAuditDto(other),
    sameDomain: base.domain === other.domain,
    rows: compareFindings(base.findings.map(toFindingDto) as unknown as StoredFinding[], other.findings.map(toFindingDto) as unknown as StoredFinding[]),
  }
}

// ──────────────────────── AI-assisted SEO plan (no metrics) ──────────────────

export function startSeoPlan(input: SeoPlanInput, actor: string, idempotencyKey?: string, retryOfId?: string) {
  return executeTask({
    type: 'SEO_PLAN',
    input: input as unknown as Record<string, unknown>,
    actor,
    idempotencyKey,
    retryOfId,
    run: async (ctx) => {
      // Verified context comes ONLY from our own deterministic audit (static titles, never scraped text).
      let verified: Array<{ title: string; result: string | null }> = []
      let domain: string | null = null
      if (input.auditId) {
        const audit = await loadAudit(input.auditId).catch(() => {
          throw new MarketingTaskError('AUDIT_NOT_FOUND', 'The selected audit no longer exists.')
        })
        domain = audit.domain
        verified = audit.findings
          .filter((f) => f.label === 'VERIFIED' && (f.result === 'FAIL' || f.result === 'WARN'))
          .slice(0, 25)
          .map((f) => ({ title: sanitizeLine(f.title, 120), result: f.result }))
      }

      const plan = await generateStructured({
        tool: marketingPlanTool,
        userMessage: JSON.stringify({
          task: 'SEO_PLAN',
          focus: input.focus,
          niche: input.niche ?? null,
          location: input.location ?? null,
          notes: input.notes ?? null,
          auditedDomain: domain,
          verifiedAuditFindings: verified,
          constraints:
            'No keyword search volumes, rankings, traffic or backlink data are available. Provide keyword THEMES with search intent, content gaps, blog topics, content clusters and local-SEO actions as suggestions. State no numbers you cannot source. Mark everything not drawn from verifiedAuditFindings as an ASSUMPTION or ESTIMATE.',
        }),
        normalize: (raw) => normalizePlan(raw, { hasVerifiedData: verified.length > 0 }),
      })

      let strategy
      try {
        strategy = await prisma.marketingStrategy.create({
          data: {
            kind: 'SEO_PLAN',
            title: plan.title,
            objective: plan.objective,
            audience: plan.audience,
            evidence: plan.evidence as unknown as Prisma.InputJsonValue,
            items: plan.items as unknown as Prisma.InputJsonValue,
            kpis: plan.kpis as unknown as Prisma.InputJsonValue,
            origin: 'AI',
            generatedByTaskId: ctx.taskId,
            createdBy: actor,
          },
        })
      } catch (error) {
        throw dbError('A database error occurred while saving the plan.', error)
      }
      return { resultType: 'STRATEGY', resultIds: [strategy.id] }
    },
  })
}
