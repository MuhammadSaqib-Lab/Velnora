import { env } from '../config/env.js'
import { AnthropicProvider } from '../ai/providers/AnthropicProvider.js'
import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import { getAgentConfigForAdmin } from './agentConfig.service.js'
import { toDraftDto } from './marketingSocial.service.js'
import { toTaskDto } from './marketingTask.service.js'

/**
 * Read-only views for the Digital Marketing overview, integrations and
 * settings pages. Every number comes from the database or from real
 * configuration state; nothing is estimated, and no credential value is ever
 * returned (only whether one is configured).
 */

const aiProvider = new AnthropicProvider()

export interface IntegrationInfo {
  key: string
  name: string
  purpose: string
  /** CONFIGURED = credentials present; AVAILABLE = usable without credentials; NOT_CONNECTED = not usable. */
  status: 'CONFIGURED' | 'AVAILABLE' | 'NOT_CONNECTED'
  /** False = no connector exists in Velnora yet, so it cannot be connected from the dashboard. */
  supported: boolean
  detail: string
  setupSteps: string[]
}

export async function getIntegrations(): Promise<IntegrationInfo[]> {
  const aiConfigured = await aiProvider.healthCheck()
  const notBuilt = (key: string, name: string, purpose: string, steps: string[]): IntegrationInfo => ({
    key,
    name,
    purpose,
    status: 'NOT_CONNECTED',
    supported: false,
    detail: 'Not connected. Velnora has no connector for this service yet, so it cannot be connected from the dashboard and no data from it is shown.',
    setupSteps: steps,
  })

  return [
    {
      key: 'ai',
      name: 'AI provider (Anthropic)',
      purpose: 'Generates social drafts, strategies, campaign ideas and SEO plans.',
      status: aiConfigured ? 'CONFIGURED' : 'NOT_CONNECTED',
      supported: true,
      detail: aiConfigured
        ? 'An API key is configured on the backend. The connection itself is only verified when a task runs.'
        : 'No API key is configured, so AI generation tasks fail with a clear message. SEO audits do not need it.',
      setupSteps: ['Create an API key in your Anthropic console.', 'Set ANTHROPIC_API_KEY in the backend environment (e.g. the Render dashboard).', 'Redeploy the backend.'],
    },
    {
      key: 'pagespeed',
      name: 'Google PageSpeed Insights',
      purpose: 'Core Web Vitals (lab and, where Google has it, real-user data) inside SEO audits.',
      status: env.GOOGLE_PAGESPEED_API_KEY ? 'CONFIGURED' : 'AVAILABLE',
      supported: true,
      detail: env.GOOGLE_PAGESPEED_API_KEY
        ? 'An API key is configured, giving a higher quota.'
        : 'Works without a key at a low quota. If Google is unavailable or rate-limited, audits report Core Web Vitals as unavailable rather than guessing.',
      setupSteps: ['Optional: create an API key in Google Cloud Console (PageSpeed Insights API).', 'Set GOOGLE_PAGESPEED_API_KEY in the backend environment.', 'Redeploy the backend.'],
    },
    notBuilt('searchConsole', 'Google Search Console', 'Real search impressions, clicks, rankings and indexing status.', [
      'A connector must be built first (read-only OAuth, scope webmasters.readonly).',
      'Then: verify your site as a Search Console property and authorize read-only access.',
    ]),
    notBuilt('analytics', 'Google Analytics 4', 'Real traffic, engagement and conversion data.', [
      'A connector must be built first (read-only OAuth, scope analytics.readonly).',
      'Then: authorize access to your GA4 property.',
    ]),
    notBuilt('businessProfile', 'Google Business Profile', 'Local listing status and performance.', [
      'A connector must be built first (Business Profile API access is granted by Google on request).',
      'Then: authorize the account that manages your profile.',
    ]),
    notBuilt('keywordProvider', 'Keyword research / SEO data provider', 'Search volume, keyword difficulty and backlink data.', [
      'Choose an approved provider (for example a keyword/backlink data API).',
      'A connector must be built, with the provider API key stored on the backend only.',
    ]),
    notBuilt('social', 'Social publishing & analytics APIs', 'Publishing and performance data for LinkedIn, Instagram, Facebook, TikTok, X and YouTube.', [
      'Each platform needs an approved API app, OAuth consent and a connector.',
      'Publishing would additionally require an explicit approval workflow. Velnora does not publish anything today.',
    ]),
  ]
}

export async function getMarketingOverview() {
  const config = await getAgentConfigForAdmin('DIGITAL_MARKETING')
  const draftStatuses = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'] as const
  const campaignStatuses = ['DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const
  const strategyStatuses = ['DRAFT', 'APPROVED', 'ARCHIVED'] as const
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  try {
    const [draftCounts, campaignCounts, strategyCounts, upcoming, latestAudits, recentTasks] = await Promise.all([
      Promise.all(draftStatuses.map((status) => prisma.socialContentDraft.count({ where: { status } }))),
      Promise.all(campaignStatuses.map((status) => prisma.marketingCampaign.count({ where: { status } }))),
      Promise.all(strategyStatuses.map((status) => prisma.marketingStrategy.count({ where: { status } }))),
      prisma.socialContentDraft.findMany({ where: { plannedFor: { gte: today }, status: { not: 'ARCHIVED' } }, orderBy: { plannedFor: 'asc' }, take: 5 }),
      prisma.seoAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 1 }),
      prisma.marketingTask.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    ])
    const toMap = <T extends string>(keys: readonly T[], counts: number[]) => Object.fromEntries(keys.map((k, i) => [k, counts[i]])) as Record<T, number>
    const latest = latestAudits[0] as { id: string; domain: string; url: string; kind: string; createdAt: Date; summary: unknown } | undefined

    return {
      agent: { enabled: config.enabled, configVersion: config.version, updatedAt: config.updatedAt, updatedBy: config.updatedBy },
      content: toMap(draftStatuses, draftCounts),
      campaigns: toMap(campaignStatuses, campaignCounts),
      strategies: toMap(strategyStatuses, strategyCounts),
      upcomingContent: (upcoming as Array<Parameters<typeof toDraftDto>[0]>).map(toDraftDto),
      latestAudit: latest ? { id: latest.id, domain: latest.domain, url: latest.url, kind: latest.kind, createdAt: latest.createdAt, summary: latest.summary } : null,
      recentTasks: (recentTasks as Array<Parameters<typeof toTaskDto>[0]>).map(toTaskDto),
    }
  } catch (error) {
    throw new AppError(500, 'A database error occurred while loading the overview.', undefined, { cause: error })
  }
}

/** Plain-language list of what this agent can never do — mirrored from the locked backend policy. */
export const HARD_RESTRICTIONS = [
  'It never publishes or posts anything. Social content stays a draft; "approved" and a planned date are records only.',
  'It never sends emails, direct messages or any outreach. There is no sending capability in Velnora.',
  'It never spends money or changes advertising. A campaign set to "Active" starts nothing anywhere.',
  'It never invents analytics, rankings, search volumes, traffic, backlinks, conversion rates, testimonials or results — missing data is shown as unavailable.',
  'It treats website content and pasted notes as data, never as instructions, and cannot access customer records, credentials or payment data.',
] as const

export async function getMarketingSettings() {
  const config = await getAgentConfigForAdmin('DIGITAL_MARKETING')
  return {
    agent: { enabled: config.enabled, configVersion: config.version, updatedAt: config.updatedAt, updatedBy: config.updatedBy },
    hardRestrictions: HARD_RESTRICTIONS,
    limits: {
      taskRateLimit: { max: env.MARKETING_TASK_RATE_LIMIT_MAX, windowSeconds: Math.round(env.MARKETING_TASK_RATE_LIMIT_WINDOW_MS / 1000) },
      maxConcurrentTasks: env.MARKETING_MAX_CONCURRENT_TASKS,
      seoAudit: { maxPages: 6, maxLinkChecks: 15, timeBudgetSeconds: 45, maxPageSizeMB: 2 },
      aiMaxTokens: env.MARKETING_AI_MAX_TOKENS,
    },
    aiConfigured: await aiProvider.healthCheck(),
  }
}
