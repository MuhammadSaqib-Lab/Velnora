import { z } from 'zod'
import {
  emailSchema,
  messageSchema,
  nameSchema,
  optionalBudgetSchema,
  optionalCompanySchema,
  optionalPhoneSchema,
  optionalProjectTypeSchema,
} from './shared.js'

export const contactSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    company: optionalCompanySchema,
    phone: optionalPhoneSchema,
    projectType: optionalProjectTypeSchema,
    budgetRange: optionalBudgetSchema,
    message: messageSchema,
  })
  .strict()

export type ContactInput = z.infer<typeof contactSchema>
