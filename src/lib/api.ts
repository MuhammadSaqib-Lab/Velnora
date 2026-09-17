/**
 * Thin fetch wrapper for the Velnora backend (see backend/README.md).
 * Centralizes the base URL, JSON handling, and the network/validation/
 * server error distinction every form needs, so each form's submit
 * handler stays focused on its own fields.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

export interface ApiSuccess<T = unknown> {
  success: true
  message: string
  data?: T
}

export interface ApiErrorResponse {
  success: false
  message: string
  errors?: Record<string, string>
}

export type ApiResult<T = unknown> = ApiSuccess<T> | ApiErrorResponse

/**
 * Thrown for network failures (backend unreachable, DNS, offline) so
 * callers can show "check your connection" copy distinct from a
 * validation or server error, both of which arrive as a normal
 * (non-throwing) ApiErrorResponse instead.
 */
export class ApiNetworkError extends Error {
  constructor() {
    super('Could not reach the server. Check your connection and try again.')
    this.name = 'ApiNetworkError'
  }
}

async function parseApiResult<T>(response: Response): Promise<ApiResult<T>> {
  try {
    return (await response.json()) as ApiResult<T>
  } catch {
    // Response wasn't JSON at all (e.g. a proxy/500 HTML error page).
    return { success: false, message: 'Something went wrong on our end. Please try again shortly.' }
  }
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      // Always sent: harmless for the public, cookie-less endpoints
      // (contact, project inquiry, AI chat), and required for the Admin
      // Dashboard's httpOnly session cookie (POST /api/auth/admin/login,
      // /logout, and every /api/admin/* write) to actually flow on a
      // cross-origin request — see backend SECURITY.md's "Admin
      // Dashboard security" section for the CORS/cookie reasoning.
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiNetworkError()
  }

  return parseApiResult<T>(response)
}

export async function apiGet<T = unknown>(path: string, headers?: Record<string, string>): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers })
  } catch {
    throw new ApiNetworkError()
  }

  return parseApiResult<T>(response)
}

/**
 * Used only by internal pages (src/pages/internal/) for PATCH requests —
 * no public form needs PATCH today.
 */
export async function apiPatch<T = unknown>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiNetworkError()
  }

  return parseApiResult<T>(response)
}
