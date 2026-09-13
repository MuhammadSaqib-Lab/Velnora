import { isProduction } from '../config/env.js'

/**
 * Minimal structured logger. Deliberately does not accept arbitrary
 * request bodies or error objects wholesale, callers pass a short event
 * name and a small metadata object, keeping personal form data (names,
 * emails, messages) out of logs by construction rather than by
 * discipline. See SECURITY.md "Safe logging" for the reasoning.
 */
type LogMeta = Record<string, string | number | boolean | undefined>

function write(level: 'info' | 'warn' | 'error', event: string, meta?: LogMeta) {
  const entry = {
    level,
    event,
    time: new Date().toISOString(),
    ...meta,
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (event: string, meta?: LogMeta) => write('info', event, meta),
  warn: (event: string, meta?: LogMeta) => write('warn', event, meta),
  /**
   * `detail` is only included outside production so local/dev debugging
   * still has useful context, without ever shipping stack traces or
   * internal error text into production log output by default.
   */
  error: (event: string, error: unknown, meta?: LogMeta) => {
    const detail = !isProduction && error instanceof Error ? error.message : undefined
    write('error', event, { ...meta, detail })
  },
}
