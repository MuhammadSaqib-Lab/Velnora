import { z } from 'zod'
import { optionalBudgetSchema, optionalRepoLinkSchema } from './shared.js'

/**
 * Client Portal project types. Kept as plain strings in the database (same
 * convention as ProjectInquiry.projectType — option labels are frontend
 * copy and shouldn't need a migration to change) but validated against
 * this allowlist at the API boundary. Must stay in sync with
 * src/pages/client/projectOptions.ts in the frontend.
 */
export const CLIENT_PROJECT_TYPES = [
  'business-website',
  'ecommerce-website',
  'web-application',
  'ai-website',
  'ai-automation',
  'seo',
  'digital-marketing',
  'website-redesign',
  'custom',
  'other',
] as const

export const PROJECT_TIMELINES = ['asap', '1-2-weeks', '1-month', '1-3-months', 'flexible'] as const

/**
 * Mirrors the Prisma `ProjectStatus` enum. The enum is the real
 * constraint; this list lets Zod reject an invalid value with a 400
 * before it ever reaches the database.
 */
export const PROJECT_STATUSES = [
  'NEW_REQUEST',
  'REVIEWING',
  'APPROVED',
  'IN_PROGRESS',
  'CLIENT_REVIEW',
  'REVISION',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
] as const

export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number]

// Control characters other than tab / newline / carriage return.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

function emptyToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

function text(label: string, min: number, max: number) {
  return z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`)
    .refine((value) => !CONTROL_CHARS.test(value), `${label} contains unsupported characters`)
}

function optionalText(label: string, max: number) {
  return z.preprocess(emptyToUndefined, text(label, 1, max).optional())
}

/**
 * Strict on purpose. There is deliberately NO `clientId`, `status`,
 * `projectNumber`, `id` or timestamp here: the owner comes from the
 * session, the status always starts at NEW_REQUEST, the number is a
 * database sequence. An attempt to send any of them is a 400, not a
 * silently-ignored field (mass assignment).
 */
export const projectCreateSchema = z
  .object({
    projectName: text('Project name', 3, 120),
    projectType: z.enum(CLIENT_PROJECT_TYPES, { errorMap: () => ({ message: 'Choose a project type' }) }),
    description: text('Project description', 20, 5000),
    websiteUrl: optionalRepoLinkSchema,
    targetAudience: optionalText('Target audience', 500),
    requiredFeatures: optionalText('Required features', 3000),
    budgetRange: optionalBudgetSchema,
    timeline: z.preprocess(emptyToUndefined, z.enum(PROJECT_TIMELINES).optional()),
    additionalNotes: optionalText('Additional notes', 2000),
  })
  .strict()

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>

/** Admin: change a project's status, with an optional message the client will see. */
export const projectStatusUpdateSchema = z
  .object({
    status: z.enum(PROJECT_STATUSES, { errorMap: () => ({ message: 'Choose a valid status' }) }),
    message: z.preprocess(emptyToUndefined, text('Message', 1, 1000).optional()),
  })
  .strict()

export type ProjectStatusUpdateInput = z.infer<typeof projectStatusUpdateSchema>

export const adminProjectListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    sort: z.enum(['newest', 'oldest', 'updated_desc']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export type AdminProjectListQuery = z.infer<typeof adminProjectListQuerySchema>
