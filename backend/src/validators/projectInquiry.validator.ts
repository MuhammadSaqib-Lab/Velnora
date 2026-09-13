import { z } from 'zod'
import {
  emailSchema,
  messageSchema,
  nameSchema,
  optionalBudgetRangeSchema,
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
    budgetRange: optionalBudgetRangeSchema,
    message: messageSchema,
    repoLink: optionalRepoLinkSchema,
  })
  .strict()

export type ProjectInquiryInput = z.infer<typeof projectInquirySchema>
