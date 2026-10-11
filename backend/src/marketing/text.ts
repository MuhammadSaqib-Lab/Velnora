import { z } from 'zod'

/**
 * Text handling shared by everything the Digital Marketing agent stores.
 *
 * Two different situations, handled differently on purpose:
 *  - ADMIN INPUT (forms) is validated strictly and REJECTED when it contains
 *    control characters or active markup — an admin typing `<script>` is a
 *    mistake or an attack worth surfacing.
 *  - MODEL OUTPUT / EXTERNAL DATA is SANITIZED instead (stripped and
 *    length-capped) — the model can't be asked to retry a form field, and a
 *    scraped page can contain anything.
 * Either way the stored text is plain text that the UI only ever renders as
 * text (React escapes it) — never as HTML.
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_GLOBAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const ACTIVE_TAGS = /<\s*\/?\s*(?:script|iframe|object|embed|style|link|meta|svg|form|base)\b[^>]*>?/gi
const ACTIVE_CONTENT = /<\s*\/?\s*(?:script|iframe|object|embed|style|link|meta|svg|form|base)\b|javascript\s*:|\son[a-z]+\s*=/i

/** Strips control characters and active markup, normalizes newlines, caps length. For model output / external data. */
export function sanitizeText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const cleaned = value
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_GLOBAL, '')
    .replace(ACTIVE_TAGS, '')
    .replace(/javascript\s*:/gi, '')
    .trim()
  return cleaned.length > max ? `${cleaned.slice(0, max).trimEnd()}…` : cleaned
}

/** One-line variant (titles, names): also collapses all whitespace. */
export function sanitizeLine(value: unknown, max: number): string {
  return sanitizeText(value, max * 2).replace(/\s+/g, ' ').slice(0, max).trim()
}

function base(label: string, min: number, max: number) {
  return z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .transform((value) => value.replace(/\r\n?/g, '\n').trim())
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
        .max(max, `${label} must be ${max} characters or fewer`)
        .refine((value) => !CONTROL_CHARS.test(value), `${label} contains unsupported characters`)
        .refine((value) => !ACTIVE_CONTENT.test(value), `${label} must be plain text — HTML/script markup is not allowed`),
    )
}

/** Required plain text from an admin form. */
export function plainText(label: string, min: number, max: number) {
  return base(label, min, max)
}

/** Optional plain text from an admin form; blank becomes undefined. */
export function optionalPlainText(label: string, max: number) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), base(label, 1, max).optional())
}
