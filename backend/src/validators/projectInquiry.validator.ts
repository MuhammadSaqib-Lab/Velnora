import { z } from 'zod'
import {
  emailSchema,
  messageSchema,
  nameSchema,
  optionalBudgetSchema,
  optionalCompanySchema,
  optionalPhoneSchema,
  optionalProjectTypeSchema,
  optionalRepoLinkSchema,
} from './shared.js'

export const projectInquirySchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    company: optionalCompanySchema,
    phone: optionalPhoneSchema,
    projectType: optionalProjectTypeSchema,
    budgetRange: optionalBudgetSchema,
    message: messageSchema,
    repoLink: optionalRepoLinkSchema,
  })
  .strict()

export type ProjectInquiryInput = z.infer<typeof projectInquirySchema>
