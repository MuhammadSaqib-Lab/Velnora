import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodTypeAny } from 'zod'
import type { ApiError } from '../types/api.js'

/**
 * Same idea as validateBody.ts, for query strings instead of JSON
 * bodies. Stores the parsed, typed result on `res.locals.query` rather
 * than reassigning `req.query` — Express types `req.query` as its own
 * `ParsedQs` shape, and overwriting it with an arbitrary parsed object
 * fights that type rather than working with it.
 */
export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'query'
        if (!errors[key]) errors[key] = issue.message
      }

      const response: ApiError = {
        success: false,
        message: 'Please check the query parameters and try again.',
        errors,
      }
      res.status(400).json(response)
      return
    }

    res.locals.query = result.data
    next()
  }
}
