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

  // AI Lead Finder Agent (Phase 4). All optional, same reasoning as the
  // AI Client Handling Agent above: the rest of the API must keep
  // working without any of these, individual /api/leads/* operations
  // degrade to a clear "not configured" error instead.
  LEAD_FINDER_ADMIN_TOKEN: z.string().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  LEAD_FINDER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  LEAD_FINDER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  LEAD_EMAIL_AI_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),

  // Gmail OAuth (draft creation only, see backend/src/leadFinder/gmail/).
  // GOOGLE_REFRESH_TOKEN is obtained once via the GET /api/leads/gmail/
  // auth-url -> oauth-callback flow and then copied into .env by hand —
  // deliberately an env var, not a database row, per the project's
  // existing "secrets live in environment variables" convention.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().min(1).optional(),
  GOOGLE_REFRESH_TOKEN: z.string().min(1).optional(),

  // Admin Dashboard authentication (Phase 5 auth upgrade). Both optional:
  // leave unset and no AdminUser is bootstrapped, so POST
  // /api/auth/admin/login simply returns "invalid email or password" for
  // everyone until an account exists (created via this bootstrap or
  // directly in the database) — the server never fails to start over it.
  // Consumed exactly once per matching email, see
  // adminAuth.service.ts's bootstrapInitialAdminUser; the plaintext value
  // is hashed immediately and never stored, logged, or returned by any
  // endpoint. A minimum length is enforced the same way other
  // security-relevant config is validated at startup (fail fast, not a
  // silently-weak default).
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),

  // How long an admin session cookie stays valid before requiring a
  // fresh login. Default 12 hours, a reasonable single-shift window for
  // an internal tool with no "remember me" concept yet.
  ADMIN_SESSION_TTL_MS: z.coerce.number().int().positive().default(12 * 60 * 60 * 1000),

  // Brute-force defense for POST /api/auth/admin/login, keyed by IP only
  // (not by the submitted email — a per-account lockout would let an
  // attacker lock out the real admin just by submitting wrong passwords
  // for their address).
  ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  ADMIN_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
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
