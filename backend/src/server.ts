import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './database/prisma.js'
import { logger } from './utils/logger.js'

const app = createApp()

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
