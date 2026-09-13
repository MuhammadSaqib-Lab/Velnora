/**
 * A known, expected error with an HTTP status and a message that's safe
 * to show to a client. Anything thrown that ISN'T an AppError is treated
 * by the error handler as unexpected and gets a generic message instead,
 * so a stray database or filesystem error never leaks details publicly.
 *
 * `cause` (native Error option) can carry the original error, e.g. a
 * raw Prisma exception, for server-side logging only. It's never
 * serialized into an API response.
 */
export class AppError extends Error {
  readonly statusCode: number
  readonly errors?: Record<string, string>

  constructor(
    statusCode: number,
    message: string,
    errors?: Record<string, string>,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.errors = errors
  }
}
