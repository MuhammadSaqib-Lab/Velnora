export interface ContactFormData {
  name: string
  email: string
  company: string
  phone: string
  projectType: string
  budget: string
  message: string
  repoLink: string
}

export type ContactFormErrors = Partial<Record<keyof ContactFormData, string>>

export function validateContactForm(data: ContactFormData): ContactFormErrors {
  const errors: ContactFormErrors = {}

  if (!data.name.trim()) {
    errors.name = 'Please enter your name.'
  }

  if (!data.email.trim()) {
    errors.email = 'Please enter your email address.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address.'
  }

  if (!data.message.trim()) {
    errors.message = 'Tell us a little about your project.'
  } else if (data.message.trim().length < 10) {
    errors.message = 'A few more details would help us respond properly.'
  }

  if (data.repoLink.trim() && !/^https?:\/\/.+/i.test(data.repoLink.trim())) {
    errors.repoLink = 'Include the full link, starting with https://.'
  }

  return errors
}

export const ACCEPTED_HANDOVER_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz'] as const
export const MAX_HANDOVER_FILE_SIZE_BYTES = 50 * 1024 * 1024

/**
 * Frontend-only for this phase. Swap the body of this function for a real
 * request (e.g. `fetch('/api/contact', { method: 'POST', body: ... })`)
 * once a backend exists, the Contact section only depends on this
 * function's signature, so the UI won't need to change.
 *
 * `attachments` are staged client-side only right now (see FileHandover.tsx),
 * actual file transfer needs a real upload endpoint (presigned URL or
 * multipart handler) and isn't wired up yet.
 */
export async function submitContactForm(
  _data: ContactFormData,
  _attachments: File[] = [],
): Promise<{ ok: true }> {
  await new Promise((resolve) => setTimeout(resolve, 900))
  return { ok: true }
}
