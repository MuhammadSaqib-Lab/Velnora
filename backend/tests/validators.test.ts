import { describe, expect, it } from 'vitest'
import { contactSchema } from '../src/validators/contact.validator.js'
import { projectInquirySchema } from '../src/validators/projectInquiry.validator.js'

const validContact = {
  name: 'Jordan Ashworth',
  email: 'jordan@example.com',
  company: '',
  phone: '',
  projectType: '',
  budgetRange: '',
  message: 'We need a new marketing site with better SEO.',
}

describe('contactSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = contactSchema.safeParse(validContact)
    expect(result.success).toBe(true)
  })

  it('rejects a missing name', () => {
    const result = contactSchema.safeParse({ ...validContact, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = contactSchema.safeParse({ ...validContact, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a message shorter than 10 characters', () => {
    const result = contactSchema.safeParse({ ...validContact, message: 'too short' })
    expect(result.success).toBe(false)
  })

  it('rejects a name over the max length', () => {
    const result = contactSchema.safeParse({ ...validContact, name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown projectType value', () => {
    const result = contactSchema.safeParse({ ...validContact, projectType: 'not-a-real-option' })
    expect(result.success).toBe(false)
  })

  it('accepts a known projectType and budgetRange', () => {
    const result = contactSchema.safeParse({
      ...validContact,
      projectType: 'new-website',
      budgetRange: '1k-2.5k',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown extra fields (strict mode)', () => {
    const result = contactSchema.safeParse({ ...validContact, isAdmin: true })
    expect(result.success).toBe(false)
  })
})

describe('projectInquirySchema', () => {
  const validInquiry = { ...validContact, repoLink: '' }

  it('accepts a minimal valid payload', () => {
    expect(projectInquirySchema.safeParse(validInquiry).success).toBe(true)
  })

  it('accepts a valid https repo link', () => {
    const result = projectInquirySchema.safeParse({
      ...validInquiry,
      repoLink: 'https://github.com/example/repo',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a javascript: URL scheme', () => {
    const result = projectInquirySchema.safeParse({
      ...validInquiry,
      repoLink: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a data: URL scheme', () => {
    const result = projectInquirySchema.safeParse({
      ...validInquiry,
      repoLink: 'data:text/html,<script>alert(1)</script>',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed URL', () => {
    const result = projectInquirySchema.safeParse({ ...validInquiry, repoLink: 'not a url' })
    expect(result.success).toBe(false)
  })
})
