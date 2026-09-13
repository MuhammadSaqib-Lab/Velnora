import { z } from 'zod'

/**
 * Must stay in sync with the <select> options in the frontend's
 * src/sections/Contact.tsx. Kept as backend-owned constants (not
 * imported from the frontend package) since this is a separately
 * deployable service; duplication here is deliberate, not an oversight.
 */
export const PROJECT_TYPES = ['new-website', 'redesign', 'ai-solution', 'seo', 'other'] as const
export const BUDGET_RANGES = ['under-500', '500-1k', '1k-2.5k', '2.5k-plus', 'not-sure'] as const

const MAX_LENGTHS = {
  name: 100,
  email: 254,
  company: 150,
  phone: 30,
  message: 2000,
  url: 500,
} as const

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:'])

/** Same reasoning as the frontend's isSafeHttpUrl (src/lib/validation.ts):
 * Zod's built-in `.url()` accepts any syntactically valid URL, including
 * `javascript:` and `data:` schemes. Reject everything but http/https. */
function isSafeHttpUrl(value: string): boolean {
  try {
    return ALLOWED_URL_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

/** Converts an empty string (what an untouched optional <select>/<input>
 * sends) into `undefined` before the rest of the schema runs. */
function emptyToUndefined(value: unknown) {
  return value === '' ? undefined : value
}

export const nameSchema = z.string().trim().min(1, 'Name is required').max(MAX_LENGTHS.name)

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(MAX_LENGTHS.email)
  .email('Enter a valid email address')

export const messageSchema = z
  .string()
  .trim()
  .min(10, 'Message must be at least 10 characters')
  .max(MAX_LENGTHS.message)

export const optionalCompanySchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(MAX_LENGTHS.company).optional(),
)

export const optionalPhoneSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(MAX_LENGTHS.phone)
    .regex(/^[0-9+\-().\s]{6,30}$/, 'Enter a valid phone number')
    .optional(),
)

export const optionalProjectTypeSchema = z.preprocess(emptyToUndefined, z.enum(PROJECT_TYPES).optional())

export const optionalBudgetRangeSchema = z.preprocess(emptyToUndefined, z.enum(BUDGET_RANGES).optional())

export const optionalRepoLinkSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(MAX_LENGTHS.url)
    .refine(isSafeHttpUrl, 'Include the full link, starting with https://')
    .optional(),
)
