import { z } from 'zod'
import {
  emailSchema,
  nameSchema,
  optionalCompanySchema,
  optionalPhoneSchema,
  optionalRepoLinkSchema,
} from './shared.js'

/**
 * Validates the `save_lead` tool call's input the model sends back —
 * model output is external input just like an HTTP body, and is
 * validated the same way before it ever touches the database. Reuses the
 * same field schemas as contact/projectInquiry validators (name, email,
 * company, phone, and the safe-URL check originally written for
 * repoLink, reused here for `website`) rather than redefining them.
 */
export const saveLeadInputSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: optionalPhoneSchema,
    company: optionalCompanySchema,
    website: optionalRepoLinkSchema,
    service: z.string().trim().max(150).optional(),
    requirements: z.string().trim().min(1, 'A project description is required').max(2000),
    budget: z.string().trim().max(100).optional(),
    timeline: z.string().trim().max(100).optional(),
    intent: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  })
  .strict()

export type SaveLeadInput = z.infer<typeof saveLeadInputSchema>
