import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma CLI stops auto-loading .env once a prisma.config.ts exists, so
// DATABASE_URL must be loaded explicitly here for `prisma migrate`/`generate`/
// `studio` to see it (the running server loads it separately via
// src/config/env.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed/seed.ts',
  },
})
