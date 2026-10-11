/**
 * A failure whose message is safe to store on a task and show to an admin.
 * Anything that is NOT a MarketingTaskError is treated as unexpected: it is
 * logged server-side and the task gets a generic message — raw provider,
 * network or database error text never reaches a task row or a response.
 */
export class MarketingTaskError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'MarketingTaskError'
    this.code = code
  }
}

export const AI_NOT_CONFIGURED = new MarketingTaskError(
  'AI_NOT_CONFIGURED',
  'The AI provider is not configured. Ask the developer to set ANTHROPIC_API_KEY on the backend, then retry.',
)
