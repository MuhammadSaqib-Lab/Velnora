import 'dotenv/config'
import { z } from 'zod'

/**
 * Validates process.env once at startup and fails fast with a clear
 * message if something required is missing or malformed, rather than
 * surfacing a confusing error later (e.g. a Prisma connection failure
 * with no context) or silently running with an insecure default.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FRONTEND_URL: z.string().min(1, 'FRONTEND_URL is required'),
  CONTACT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  CONTACT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  // AI Client Handling Agent (Phase 3). Optional by design: the rest of
  // the API must keep working even before a real key is provisioned, the
  // AI endpoint alone degrades to a friendly "not configured" error
  // (see backend/src/services/aiChat.service.ts) rather than the whole
  // server failing to start.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default('claude-opus-5'),
  AI_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('low'),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  AI_CHAT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  AI_CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AI_MAX_MESSAGES_PER_CONVERSATION: z.coerce.number().int().positive().default(40),
})

function loadEnv() {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment configuration:')
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }
  return parsed.data
}

export const env = loadEnv()

/**
 * Origins allowed by CORS. Supports a comma-separated list in
 * FRONTEND_URL so previews/staging can be added without code changes.
 */
export const allowedOrigins = env.FRONTEND_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const isProduction = env.NODE_ENV === 'production'
