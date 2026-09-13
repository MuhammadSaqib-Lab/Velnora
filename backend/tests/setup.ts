/**
 * Runs before every test file. Sets safe, non-secret placeholder env
 * vars so src/config/env.ts's Zod validation passes without needing a
 * real .env or a live database, tests that touch the database mock
 * Prisma directly (see tests/contact.test.ts), they never open a real
 * connection.
 */
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/velnora_test'
process.env.FRONTEND_URL ??= 'http://localhost:5173'
process.env.PORT ??= '4000'
