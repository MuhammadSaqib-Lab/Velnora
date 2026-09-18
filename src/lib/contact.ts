import { isSafeHttpUrl, MAX_LENGTHS } from './validation'

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

  const name = data.name.trim()
  if (!name) {
    errors.name = 'Please enter your name.'
  } else if (name.length > MAX_LENGTHS.name) {
    errors.name = `Keep your name under ${MAX_LENGTHS.name} characters.`
  }

  const email = data.email.trim()
  if (!email) {
    errors.email = 'Please enter your email address.'
  } else if (email.length > MAX_LENGTHS.email) {
    errors.email = 'That email address is too long.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email address.'
  }

  if (data.company.trim().length > MAX_LENGTHS.company) {
    errors.company = `Keep your company name under ${MAX_LENGTHS.company} characters.`
  }

  if (data.phone.trim().length > MAX_LENGTHS.phone) {
    errors.phone = `Keep your phone number under ${MAX_LENGTHS.phone} characters.`
  }

  if (data.budget.trim().length > MAX_LENGTHS.budget) {
    errors.budget = `Keep this under ${MAX_LENGTHS.budget} characters.`
  }

  const message = data.message.trim()
  if (!message) {
    errors.message = 'Tell us a little about your project.'
  } else if (message.length < 10) {
    errors.message = 'A few more details would help us respond properly.'
  } else if (message.length > MAX_LENGTHS.message) {
    errors.message = `Keep your message under ${MAX_LENGTHS.message} characters.`
  }

  const repoLink = data.repoLink.trim()
  if (repoLink) {
    if (repoLink.length > MAX_LENGTHS.url) {
      errors.repoLink = 'That link is too long.'
    } else if (!isSafeHttpUrl(repoLink)) {
      errors.repoLink = 'Include the full link, starting with https://.'
    }
  }

  return errors
}

export const ACCEPTED_HANDOVER_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz'] as const
export const MAX_HANDOVER_FILE_SIZE_BYTES = 50 * 1024 * 1024

// Submission itself is handled by src/lib/api.ts's apiPost, called
// directly from Contact.tsx, this file only validates. Attachments
// (see FileHandover.tsx) are still staged client-side only; actual file
// transfer needs a real upload endpoint (presigned URL or multipart
// handler), which isn't built yet. File extension/size checks there are
// UX only, a real upload endpoint must re-validate file type by content
// (not filename) and size server-side.
