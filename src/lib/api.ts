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

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiNetworkError()
  }

  let payload: ApiResult<T>
  try {
    payload = (await response.json()) as ApiResult<T>
  } catch {
    // Response wasn't JSON at all (e.g. a proxy/500 HTML error page).
    return {
      success: false,
      message: 'Something went wrong on our end. Please try again shortly.',
    }
  }

  return payload
}

export async function apiGet<T = unknown>(path: string): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`)
  } catch {
    throw new ApiNetworkError()
  }

  try {
    return (await response.json()) as ApiResult<T>
  } catch {
    return { success: false, message: 'Something went wrong on our end. Please try again shortly.' }
  }
}
