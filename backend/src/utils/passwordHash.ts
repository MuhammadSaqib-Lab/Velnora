import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'

/**
 * Isolates the password hashing library the same way AnthropicProvider.ts
 * isolates the AI SDK — callers only ever see plain async functions, so
 * swapping bcryptjs for another bcrypt/argon2id implementation later
 * touches this one file, not every call site.
 *
 * Full production cost everywhere except the test runner. bcrypt's cost
 * factor is deliberately CPU-expensive (that's the point — it resists
 * offline brute-forcing), but the admin auth test suite exercises real
 * login flows (real hash + real compare) dozens of times across
 * parallel test workers; at cost 12 that's enough sustained CPU
 * contention to intermittently blow past the suite's timeout (this was
 * caught as a genuine flaky-test regression, not a hypothetical). Vitest
 * always sets NODE_ENV=test itself, so this can never accidentally fire
 * in development or production.
 */
const SALT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
