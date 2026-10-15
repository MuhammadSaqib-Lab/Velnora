import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_DATA_CHANGED, ADMIN_SESSION_REJECTED } from './adminEvents'
import {
  ApiAbortedError,
  ApiNetworkError,
  ApiTimeoutError,
  DEFAULT_READ_TIMEOUT_MS,
  DEFAULT_WRITE_TIMEOUT_MS,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from './api'

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** A fetch that never answers on its own but honours the abort signal, like a real stalled request. */
const hangingFetch: FetchImpl = (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })

const events: string[] = []
let fetchMock: ReturnType<typeof vi.fn<FetchImpl>>

beforeEach(() => {
  vi.useFakeTimers()
  events.length = 0
  const target = new EventTarget()
  vi.stubGlobal('window', target)
  for (const name of [ADMIN_DATA_CHANGED, ADMIN_SESSION_REJECTED]) target.addEventListener(name, () => events.push(name))
  fetchMock = vi.fn<FetchImpl>()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('request time limits — no endless spinner', () => {
  it('a read that never answers ends in a timeout error after 30 s', async () => {
    fetchMock.mockImplementation(hangingFetch)
    const outcome = apiGet('/admin/overview').then(
      () => 'resolved',
      (e: unknown) => e,
    )
    await vi.advanceTimersByTimeAsync(DEFAULT_READ_TIMEOUT_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    const error = await outcome
    expect(error).toBeInstanceOf(ApiTimeoutError)
    expect(error).toBeInstanceOf(ApiNetworkError) // existing `instanceof ApiNetworkError` handlers show its message
    expect((error as Error).message).toMatch(/taking too long.*starting up/i)
  })

  it('a write gets the longer limit (AI generations are slow) — but is still bounded', async () => {
    fetchMock.mockImplementation(hangingFetch)
    const outcome = apiPost('/admin/marketing/social/generate', { x: 1 }).then(
      () => 'resolved',
      (e: unknown) => e,
    )
    await vi.advanceTimersByTimeAsync(DEFAULT_READ_TIMEOUT_MS + 1)
    expect(await Promise.race([outcome, Promise.resolve('still waiting')])).toBe('still waiting')
    await vi.advanceTimersByTimeAsync(DEFAULT_WRITE_TIMEOUT_MS)
    expect(await outcome).toBeInstanceOf(ApiTimeoutError)
  })

  it('honours a per-call limit', async () => {
    fetchMock.mockImplementation(hangingFetch)
    const outcome = apiGet('/admin/counts', undefined, { timeoutMs: 15_000 }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(await outcome).toBeInstanceOf(ApiTimeoutError)
  })

  it('a response whose body stalls after the headers also times out', async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const stalled = {
        ok: true,
        status: 200,
        json: () =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          }),
      }
      return stalled as unknown as Response
    })
    const outcome = apiGet('/admin/overview').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(DEFAULT_READ_TIMEOUT_MS)
    expect(await outcome).toBeInstanceOf(ApiTimeoutError)
  })

  it('a fast response is untouched, and its timer does not linger', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, message: 'OK', data: { n: 1 } }))
    const result = await apiGet<{ n: number }>('/admin/overview')
    expect(result).toEqual({ success: true, message: 'OK', data: { n: 1 } })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('distinguishes an unreachable server from a slow one', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await apiGet('/admin/overview').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiNetworkError)
    expect(error).not.toBeInstanceOf(ApiTimeoutError)
  })

  it('a caller can cancel; that is reported as a cancellation, not a failure to show', async () => {
    fetchMock.mockImplementation(hangingFetch)
    const controller = new AbortController()
    const outcome = apiGet('/admin/counts', undefined, { signal: controller.signal }).catch((e: unknown) => e)
    controller.abort()
    expect(await outcome).toBeInstanceOf(ApiAbortedError)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('server error responses still arrive as normal results with their status', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, message: 'A database error occurred.' }, 500))
    expect(await apiGet('/admin/overview')).toEqual({ success: false, message: 'A database error occurred.', status: 500 })
  })
})

describe('what a request sends', () => {
  it('always includes credentials (the session cookie) and sets JSON headers only when there is a body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, message: 'OK' }))
    await apiGet('/admin/counts')
    await apiPost('/auth/admin/login', { email: 'a@b.c' })
    const [get, post] = fetchMock.mock.calls.map((c) => c[1] as RequestInit)
    expect(get).toMatchObject({ method: 'GET', credentials: 'include' })
    expect(get!.body).toBeUndefined()
    expect(post).toMatchObject({ method: 'POST', credentials: 'include', body: JSON.stringify({ email: 'a@b.c' }) })
    expect((post!.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })
})

describe('telling the dashboard something changed', () => {
  const ok = () => fetchMock.mockImplementation(async () => jsonResponse({ success: true, message: 'OK' }))

  it('announces a successful admin write so the sidebar counts refresh', async () => {
    ok()
    await apiPatch('/admin/reviews/abc/status', { status: 'APPROVED' })
    await apiPost('/admin/marketing/social/drafts/d1/status', { status: 'IN_REVIEW' })
    await apiDelete('/admin/reviews/xyz')
    await apiPost('/leads/search', {})
    expect(events).toEqual([ADMIN_DATA_CHANGED, ADMIN_DATA_CHANGED, ADMIN_DATA_CHANGED, ADMIN_DATA_CHANGED])
  })

  it('stays quiet for reads, failed writes and unrelated endpoints', async () => {
    ok()
    await apiGet('/admin/overview')
    await apiPost('/contact', { name: 'x' })
    await apiPost('/auth/admin/login', {})
    fetchMock.mockImplementation(async () => jsonResponse({ success: false, message: 'Nope' }, 400))
    await apiPatch('/admin/reviews/abc/status', { status: 'APPROVED' })
    expect(events).toEqual([])
  })

  it('announces a rejected session (401 from an admin endpoint) so the shell can send the user to sign in', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ success: false, message: 'Unauthorized. Please sign in again.' }, 401))
    await apiGet('/admin/projects')
    expect(events).toEqual([ADMIN_SESSION_REJECTED])
  })

  it('does not treat the session check itself, or other statuses, as a rejection', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ success: false, message: 'Unauthorized' }, 401))
    await apiGet('/auth/admin/me') // handled by useAdminSession directly
    fetchMock.mockImplementation(async () => jsonResponse({ success: false, message: 'Forbidden' }, 403))
    await apiGet('/admin/projects')
    fetchMock.mockImplementation(async () => jsonResponse({ success: false, message: 'Server error' }, 500))
    await apiGet('/admin/projects')
    expect(events).toEqual([])
  })
})
