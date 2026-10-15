/**
 * Thin fetch wrapper for the Velnora backend (see backend/README.md).
 * Centralizes the base URL, JSON handling, and the network/validation/
 * server error distinction every form needs, so each form's submit
 * handler stays focused on its own fields.
 */

/**
 * Defaults to a same-origin relative path, never an absolute
 * cross-origin URL. Locally, vite.config.ts's dev-server proxy forwards
 * "/api" to the local backend; in production, vercel.json's rewrite
 * forwards it to the deployed Render backend. Either way the browser
 * only ever sees one origin, which is what actually fixes the admin
 * session cookie: a genuinely cross-site deployment (Vercel + Render
 * are different registrable domains) hit both SameSite=Lax rejecting
 * the cookie on cross-site fetches, and then, after switching to
 * SameSite=None, third-party-cookie blocking (a separate browser
 * privacy feature, e.g. Chrome's "Block third-party cookies", Safari's
 * ITP) rejecting it anyway — no cookie attribute fixes a cookie that
 * isn't first-party at all. Routing everything through one origin
 * sidesteps the whole problem instead of chasing further exceptions to
 * it. VITE_API_URL can still override this (e.g. pointing local dev at
 * a remote staging backend directly), normalized to always end in
 * "/api" if set.
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL
  if (!configured) return '/api'

  const trimmed = configured.replace(/\/+$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

import { isAdminDataPath, notifyAdminDataChanged, notifyAdminSessionRejected } from '@/lib/adminEvents'

const API_BASE_URL = resolveApiBaseUrl()

/** Absolute-from-root URL for a backend path, for plain links (e.g. a file download that carries the session cookie). */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

export interface ApiSuccess<T = unknown> {
  success: true
  message: string
  data?: T
}

export interface ApiErrorResponse {
  success: false
  message: string
  errors?: Record<string, string>
  /** HTTP status of the failed response (e.g. 401 → session expired), when one was received. */
  status?: number
}

export type ApiResult<T = unknown> = ApiSuccess<T> | ApiErrorResponse

/**
 * Thrown for network failures (backend unreachable, DNS, offline) so
 * callers can show "check your connection" copy distinct from a
 * validation or server error, both of which arrive as a normal
 * (non-throwing) ApiErrorResponse instead.
 */
export class ApiNetworkError extends Error {
  constructor(message = 'Could not reach the server. Check your connection and try again.') {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

/**
 * The request did not finish within its time limit. A subclass of
 * ApiNetworkError on purpose: every existing `err instanceof ApiNetworkError`
 * handler already shows err.message, so a stalled request now ends in a
 * readable error with a retry instead of an endless spinner. The usual cause
 * is a backend that was idle and is still starting up.
 */
export class ApiTimeoutError extends ApiNetworkError {
  constructor() {
    super('The server is taking too long to respond — it may be starting up. Please try again in a moment.')
    this.name = 'ApiTimeoutError'
  }
}

/** The caller cancelled the request (e.g. the component unmounted). Not an error worth showing. */
export class ApiAbortedError extends Error {
  constructor() {
    super('Request cancelled.')
    this.name = 'ApiAbortedError'
  }
}

/** Reads are quick; 30 s still covers a cold backend. */
export const DEFAULT_READ_TIMEOUT_MS = 30_000
/** Writes include slow AI generations and audits (up to ~1 min server-side), but are still bounded. */
export const DEFAULT_WRITE_TIMEOUT_MS = 120_000

export interface RequestOptions {
  /** Overrides the default time limit for this call. */
  timeoutMs?: number
  /** Lets the caller cancel the request. */
  signal?: AbortSignal
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  headers: Record<string, string> | undefined,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const controller = new AbortController()
  let timedOut = false
  const timeoutMs = options.timeoutMs ?? (method === 'GET' ? DEFAULT_READ_TIMEOUT_MS : DEFAULT_WRITE_TIMEOUT_MS)
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortFromCaller = () => controller.abort()
  options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  if (options.signal?.aborted) controller.abort()

  const failure = (): Error =>
    options.signal?.aborted ? new ApiAbortedError() : timedOut ? new ApiTimeoutError() : new ApiNetworkError()

  try {
    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        // Always sent: harmless for the public, cookie-less endpoints
        // (contact, project inquiry, AI chat), and required for the Admin
        // Dashboard's httpOnly session cookie (POST /api/auth/admin/login,
        // /logout, and every /api/admin/* call) to flow — see backend
        // SECURITY.md's "Admin Dashboard security" section.
        credentials: 'include',
        headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      throw failure()
    }

    // The same limit covers reading the body: a response that starts and then stalls must not hang either.
    let result: ApiResult<T>
    try {
      result = await parseApiResult<T>(response)
    } catch {
      throw failure()
    }
    // A body read cut short by our own abort is a timeout / cancellation, not a vague server error.
    if (!result.success && controller.signal.aborted) throw failure()

    // The session is gone: let the admin shell send the user to the login page.
    if (!result.success && result.status === 401 && path.startsWith('/admin/')) notifyAdminSessionRejected()

    // A successful write may change what is waiting for an admin (sidebar counts).
    if (method !== 'GET' && result.success && isAdminDataPath(path)) notifyAdminDataChanged()
    return result
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

async function parseApiResult<T>(response: Response): Promise<ApiResult<T>> {
  try {
    const body = (await response.json()) as ApiResult<T>
    return body.success ? body : { ...body, status: response.status }
  } catch {
    // Response wasn't JSON at all (e.g. a proxy/500 HTML error page).
    return { success: false, message: 'Something went wrong on our end. Please try again shortly.', status: response.status }
  }
}

export function apiPost<T = unknown>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  return request<T>('POST', path, body, headers, options)
}

export function apiGet<T = unknown>(path: string, headers?: Record<string, string>, options?: RequestOptions): Promise<ApiResult<T>> {
  return request<T>('GET', path, undefined, headers, options)
}

/**
 * Used only by internal pages (src/pages/internal/) for PATCH requests —
 * no public form needs PATCH today.
 */
export function apiPatch<T = unknown>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  return request<T>('PATCH', path, body, headers, options)
}

/**
 * Used only by internal admin pages — no public form needs DELETE today.
 */
export function apiDelete<T = unknown>(path: string, headers?: Record<string, string>, options?: RequestOptions): Promise<ApiResult<T>> {
  return request<T>('DELETE', path, undefined, headers, options)
}
