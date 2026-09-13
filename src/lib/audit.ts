import { isSafeHttpUrl, MAX_LENGTHS } from './validation'

export interface AuditFormData {
  url: string
  email: string
}

export type AuditFormErrors = Partial<Record<keyof AuditFormData, string>>

export function validateAuditForm(data: AuditFormData): AuditFormErrors {
  const errors: AuditFormErrors = {}

  const url = data.url.trim()
  if (!url) {
    errors.url = 'Please enter your website URL.'
  } else if (url.length > MAX_LENGTHS.url) {
    errors.url = 'That URL is too long.'
  } else if (!isSafeHttpUrl(url)) {
    errors.url = 'Include the full URL, like https://example.com.'
  }

  const email = data.email.trim()
  if (!email) {
    errors.email = 'Please enter your email address.'
  } else if (email.length > MAX_LENGTHS.email) {
    errors.email = 'That email address is too long.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email address.'
  }

  return errors
}

/**
 * Frontend-only for this phase. Phase 2's backend covers the main
 * Contact/project-inquiry forms (see src/lib/api.ts); this one doesn't
 * have a backend endpoint yet. Swap the body for a real request once it
 * does, the FreeAudit section only depends on this function's signature.
 */
export async function submitAuditRequest(_data: AuditFormData): Promise<{ ok: true }> {
  await new Promise((resolve) => setTimeout(resolve, 900))
  return { ok: true }
}
