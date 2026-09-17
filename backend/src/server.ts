import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './database/prisma.js'
import { bootstrapInitialAdminUser } from './services/adminAuth.service.js'
import { logger } from './utils/logger.js'

const app = createApp()

async function start() {
  // Non-fatal by design: a database outage here shouldn't stop the rest
  // of the site (public forms, AI chat) from starting up. Admin login
  // will just fail until the database is reachable and this runs again
  // on the next restart.
  try {
    await bootstrapInitialAdminUser()
  } catch (error) {
    logger.error('admin.bootstrap.failed', error)
  }

  const server = app.listen(env.PORT, () => {
    logger.info('server.started', { port: env.PORT, env: env.NODE_ENV })
  })

  async function shutdown(signal: string) {
    logger.info('server.shutting_down', { signal })
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

void start()
