import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodTypeAny } from 'zod'
import type { ApiError } from '../types/api.js'

/**
 * Validates req.body against a Zod schema before it reaches a
 * controller. On failure, responds 400 with a field->message map (not a
 * raw Zod error object, which is more detail than a public API should
 * expose) and never reaches the controller/database at all.
 */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'body'
        if (!errors[key]) errors[key] = issue.message
      }

      const response: ApiError = {
        success: false,
        message: 'Please check the highlighted fields and try again.',
        errors,
      }
      res.status(400).json(response)
      return
    }

    req.body = result.data
    next()
  }
}
