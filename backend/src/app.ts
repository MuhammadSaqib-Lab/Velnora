import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { allowedOrigins } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { apiRouter } from './routes/index.js'
import type { ApiError } from './types/api.js'

export function createApp() {
  const app = express()

  // Not serving HTML from this API, and requests never go through a
  // proxy chain we control here, so this is safe to leave at its
  // secure default (don't trust X-Forwarded-* headers unless a real
  // reverse proxy setup requires it later).
  app.disable('x-powered-by')

  app.use(helmet())

  app.use(
    cors({
      origin(origin, callback) {
        // `origin` is undefined for same-origin/non-browser requests
        // (curl, server-to-server, the health check). Allow those; a
        // browser request with a mismatched Origin is rejected below.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true)
          return
        }
        callback(new Error('Not allowed by CORS'))
      },
      // Required for the admin session cookie: without this, the browser
      // refuses to send/receive it on the frontend's cross-origin fetch
      // calls even though `origin` above is never a wildcard (a hard
      // requirement for credentialed CORS anyway).
      credentials: true,
    }),
  )

  // Generous enough for every field this API accepts (see validators),
  // small enough to make a body-size abuse attempt pointless.
  app.use(express.json({ limit: '20kb' }))

  // Only used to read the admin session cookie (req.cookies); nothing in
  // this API is signed-cookie based, so no secret is passed here.
  app.use(cookieParser())

  app.use('/api', apiRouter)

  app.use(notFoundHandler)

  // CORS rejections surface as a generic Error from the `cors` package;
  // normalize them to the same ApiError shape as everything else instead
  // of falling through to the default error handler's stack trace.
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof Error && err.message === 'Not allowed by CORS') {
      const response: ApiError = { success: false, message: 'Origin not allowed.' }
      res.status(403).json(response)
      return
    }
    next(err)
  })

  app.use(errorHandler)

  return app
}
