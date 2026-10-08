import { z } from 'zod'
import { emailSchema, nameSchema, optionalCompanySchema, optionalPhoneSchema } from './shared.js'

/**
 * bcrypt only uses the first 72 BYTES of a password; longer input would
 * silently be truncated, so the cap is enforced in bytes, not characters.
 */
const MAX_PASSWORD_BYTES = 72
const MIN_PASSWORD_LENGTH = 10

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES, 'Password is too long (72 bytes maximum)')
  .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), 'Use at least one letter and one number')
  .refine((value) => !/^(.)\1+$/.test(value), 'Choose a less repetitive password')

/**
 * `.strict()`: a client cannot smuggle `role`, `id`, `isAdmin` etc. into
 * sign-up (mass assignment) — unknown fields are a 400, not ignored.
 */
export const clientRegisterSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
    phone: optionalPhoneSchema,
    company: optionalCompanySchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' })
    }
    if (data.password.toLowerCase().includes(data.email.trim().toLowerCase())) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password must not contain your email address' })
    }
  })

export type ClientRegisterInput = z.infer<typeof clientRegisterSchema>

export const clientLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    // Login validates an attempt against an existing account, not a new
    // password — no strength rules, only presence and a size bound.
    password: z.string().min(1, 'Password is required.').max(200),
  })
  .strict()

export type ClientLoginInput = z.infer<typeof clientLoginSchema>
