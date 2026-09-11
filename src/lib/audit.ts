export interface AuditFormData {
  url: string
  email: string
}

export type AuditFormErrors = Partial<Record<keyof AuditFormData, string>>

export function validateAuditForm(data: AuditFormData): AuditFormErrors {
  const errors: AuditFormErrors = {}

  if (!data.url.trim()) {
    errors.url = 'Please enter your website URL.'
  } else if (!/^https?:\/\/.+\..+/i.test(data.url.trim())) {
    errors.url = 'Include the full URL, like https://example.com.'
  }

  if (!data.email.trim()) {
    errors.email = 'Please enter your email address.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address.'
  }

  return errors
}

/**
 * Frontend-only for this phase, same pattern as submitContactForm in
 * lib/contact.ts: swap the body for a real request once a backend exists,
 * the FreeAudit section only depends on this function's signature.
 */
export async function submitAuditRequest(_data: AuditFormData): Promise<{ ok: true }> {
  await new Promise((resolve) => setTimeout(resolve, 900))
  return { ok: true }
}
