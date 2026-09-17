import { z } from 'zod'

export const adminLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    // No format/strength rules here on purpose — this validates a LOGIN
    // attempt against an already-created account, not a new password.
    // min(1) covers "missing credentials"; max(200) just bounds payload size.
    password: z.string().min(1, 'Password is required.').max(200),
  })
  .strict()

export type AdminLoginInput = z.infer<typeof adminLoginSchema>
