/**
 * Shared client-side validation helpers used by the Contact, Free Audit,
 * and quick-chat forms.
 *
 * IMPORTANT: this is UX validation only. It reduces obviously-malformed
 * submissions and caps input size, but it provides no security guarantee
 * on its own, a browser's DevTools or a raw HTTP request can bypass all
 * of it. Once a backend exists, every one of these fields must be
 * re-validated, length-capped, and sanitized server-side before it
 * touches a database, an email, or any other system.
 */
export const MAX_LENGTHS = {
  name: 100,
  email: 254, // RFC 5321 practical upper bound
  company: 150,
  phone: 30,
  message: 2000,
  url: 500,
  chatMessage: 2000, // must match backend/src/validators/aiChat.validator.ts
  reviewText: 2000, // must match backend/src/validators/review.validator.ts
  budget: 100, // free-text budget note, must match backend/src/validators/shared.ts's optionalBudgetSchema
} as const

export const MIN_REVIEW_LENGTH = 10 // must match backend/src/validators/review.validator.ts

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * True only for well-formed http(s) URLs. Rejects javascript:, data:,
 * vbscript:, and any other scheme, plus strings the URL constructor
 * can't parse at all. Used for user-entered links (repo/site URLs) that
 * currently only get echoed back as plain text, never used to navigate,
 * but should never be trusted as "safe to open" either.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ALLOWED_URL_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}
