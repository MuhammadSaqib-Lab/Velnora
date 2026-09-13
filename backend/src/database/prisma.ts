import { PrismaClient } from '@prisma/client'
import { isProduction } from '../config/env.js'

/**
 * A single shared PrismaClient instance. In dev, tsx's watch mode
 * re-executes this module on every file change, which would otherwise
 * open a new connection pool each time; stashing it on `globalThis`
 * avoids exhausting Postgres connections during local development.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  })

if (!isProduction) {
  globalForPrisma.prisma = prisma
}
