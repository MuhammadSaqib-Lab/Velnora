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

  // Render (and most PaaS hosts) puts exactly one reverse proxy in front
  // of this app, which sets X-Forwarded-For/X-Forwarded-Proto on every
  // request. `1` means "trust exactly one hop" — req.ip and
  // express-rate-limit's default IP-based keying then read the real
  // client IP from that header instead of the proxy's own address,
  // which is also otherwise a proxy IP shared by every visitor (every
  // rate limit would count as one caller). Deliberately not `true`
  // (trust the whole chain): with a single known proxy hop, only the
  // last entry in X-Forwarded-For is trustworthy, a client could still
  // forge earlier entries. express-rate-limit itself refuses to start
  // and throws a ValidationError if it sees X-Forwarded-For with trust
  // proxy left at its default `false` — this exact error is what
  // surfaced it.
  app.set('trust proxy', 1)

  // Not serving HTML from this API, so this is safe to leave at its
  // secure default.
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
