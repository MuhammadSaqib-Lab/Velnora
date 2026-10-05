import { z } from 'zod'

// Sized so a maximal save (plus JSON escaping) still fits under the app-wide
// 20kb express.json() body limit in app.ts.
export const MAX_RULES_LENGTH = 6000
export const MAX_INSTRUCTIONS_LENGTH = 8000
const MIN_INSTRUCTIONS_LENGTH = 20

// Control characters other than tab / newline / carriage return (NUL, ESC, etc.).
// eslint-disable-next-line no-control-regex
const DISALLOWED_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
// Active-content markup. Config is plain text (rendered in a <textarea>,
// sent as JSON, placed in a prompt) so none of this is ever legitimate,
// and refusing it keeps the stored text inert if it is ever rendered
// somewhere that interprets HTML.
const ACTIVE_CONTENT = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|svg|form)\b|javascript\s*:|\son[a-z]+\s*=/i

function configText(label: string, min: number, max: number) {
  return z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .transform((value) => value.replace(/\r\n?/g, '\n').trim())
    .pipe(
      z
        .string()
        .min(min, min > 0 ? `${label} must be at least ${min} characters` : `${label} is required`)
        .max(max, `${label} must be ${max} characters or fewer`)
        .refine((value) => !DISALLOWED_CONTROL_CHARS.test(value), `${label} contains unsupported control characters`)
        .refine((value) => !ACTIVE_CONTENT.test(value), `${label} must be plain text — HTML/script markup is not allowed`),
    )
}

const versionSchema = z
  .number({ required_error: 'expectedVersion is required', invalid_type_error: 'expectedVersion must be a number' })
  .int()
  .min(1)

/**
 * `.strict()` rejects any extra field outright — notably an `agentKey`,
 * `id`, `updatedBy` or `version` a client might try to smuggle in. The
 * agent is chosen by the route, the editor by the session, the new
 * version by the server.
 */
export const agentConfigUpdateSchema = z
  .object({
    rules: configText('Rules', 0, MAX_RULES_LENGTH),
    instructions: configText('Instructions', MIN_INSTRUCTIONS_LENGTH, MAX_INSTRUCTIONS_LENGTH),
    enabled: z.boolean({ required_error: 'enabled is required', invalid_type_error: 'enabled must be true or false' }),
    expectedVersion: versionSchema,
  })
  .strict()

export type AgentConfigUpdateInput = z.infer<typeof agentConfigUpdateSchema>

export const agentConfigRestoreSchema = z
  .object({
    version: versionSchema,
    expectedVersion: versionSchema,
  })
  .strict()

export type AgentConfigRestoreInput = z.infer<typeof agentConfigRestoreSchema>
