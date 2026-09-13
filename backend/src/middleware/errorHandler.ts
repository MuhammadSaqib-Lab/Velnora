import type { NextFunction, Request, Response } from 'express'
import { isProduction } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import type { ApiError } from '../types/api.js'

/**
 * Single place every error in the app funnels through. Known
 * (`AppError`) errors return their own status/message. Anything else
 * (a Prisma error, a bug, a thrown string) is logged with detail
 * server-side only and returns a generic 500 to the client, never a
 * stack trace, database message, or file path.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('request.error', err.cause ?? err, { path: req.path, method: req.method })
    }
    const response: ApiError = { success: false, message: err.message, errors: err.errors }
    res.status(err.statusCode).json(response)
    return
  }

  logger.error('request.unhandled_error', err, { path: req.path, method: req.method })

  const response: ApiError = {
    success: false,
    message: isProduction
      ? 'Something went wrong on our end. Please try again shortly.'
      : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
  }
  res.status(500).json(response)
}

export function notFoundHandler(req: Request, res: Response) {
  const response: ApiError = { success: false, message: `Route not found: ${req.method} ${req.path}` }
  res.status(404).json(response)
}
