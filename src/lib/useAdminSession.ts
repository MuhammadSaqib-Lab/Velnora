import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, ApiNetworkError } from '@/lib/api'

export interface AdminSessionUser {
  id: string
  email: string
}

export type AdminSessionState =
  | { status: 'loading' }
  /** `admin` is null (and `verified` false) only while the shell is shown optimistically, before the server has answered. */
  | { status: 'authenticated'; admin: AdminSessionUser | null; verified: boolean }
  | { status: 'unauthenticated' }
  /** The server could not be reached or failed — NOT the same as signed out. */
  | { status: 'error'; message: string }

/**
 * A non-secret UI hint: "this browser had a working admin session". It only
 * lets the dashboard frame (sidebar, layout) appear while the server is still
 * confirming the session. It carries no identity and grants nothing — every
 * data request is checked by the server's own session cookie, and the hint is
 * cleared the moment the server answers 401 or the admin signs out.
 */
const HINT_KEY = 'velnora_admin_session_hint'

export function hasAdminSessionHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

export function setAdminSessionHint(active: boolean): void {
  try {
    if (active) window.localStorage.setItem(HINT_KEY, '1')
    else window.localStorage.removeItem(HINT_KEY)
  } catch {
    // Storage can be blocked (private mode, policy); the dashboard simply waits for the server instead.
  }
}

/**
 * Session state lives entirely server-side (an httpOnly cookie the browser
 * attaches automatically, see src/lib/api.ts's `credentials: 'include'`) —
 * this hook never stores a token, it asks the server "am I logged in" via
 * GET /api/auth/admin/me and reacts to the answer.
 *
 *  - 401 → unauthenticated (the only case that sends the admin to the login page);
 *  - network failure / timeout / server error → `error`, with a retry, so a
 *    slow or restarting backend never looks like "you were logged out";
 *  - a *successful* verification is reused for a few seconds, so the login
 *    page and the dashboard shell (which mount back to back) share one request.
 *    Failures and "not signed in" are never reused.
 */
const VERIFIED_REUSE_MS = 10_000
const SESSION_CHECK_TIMEOUT_MS = 20_000

let verified: { at: number; promise: Promise<AdminSessionState> } | null = null

function checkSession(): Promise<AdminSessionState> {
  return apiGet<{ admin: AdminSessionUser }>('/auth/admin/me', undefined, { timeoutMs: SESSION_CHECK_TIMEOUT_MS })
    .then((res): AdminSessionState => {
      if (res.success && res.data) {
        setAdminSessionHint(true)
        return { status: 'authenticated', admin: res.data.admin, verified: true }
      }
      if (!res.success && res.status === 401) {
        setAdminSessionHint(false)
        return { status: 'unauthenticated' }
      }
      return { status: 'error', message: res.success ? 'Unexpected response from the server.' : res.message }
    })
    .catch(
      (err): AdminSessionState => ({
        status: 'error',
        message: err instanceof ApiNetworkError ? err.message : 'Could not verify your session. Please try again.',
      }),
    )
}

function fetchSession(force: boolean): Promise<AdminSessionState> {
  if (!force && verified && Date.now() - verified.at < VERIFIED_REUSE_MS) return verified.promise
  const promise = checkSession()
  const entry = { at: Date.now(), promise }
  verified = entry
  // Keep only successful answers around; anything else must be re-asked next time.
  void promise.then((state) => {
    if (verified === entry && !(state.status === 'authenticated' && state.verified)) verified = null
  })
  return promise
}

export function useAdminSession(options: { optimistic?: boolean } = {}) {
  const [state, setState] = useState<AdminSessionState>(() =>
    options.optimistic && hasAdminSessionHint() ? { status: 'authenticated', admin: null, verified: false } : { status: 'loading' },
  )

  // Initial check on mount.
  useEffect(() => {
    let cancelled = false
    void fetchSession(false).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Explicit re-check from an event handler (e.g. right after login, or the Retry button).
  const refresh = useCallback(() => {
    setState((current) => (current.status === 'authenticated' ? current : { status: 'loading' }))
    void fetchSession(true).then(setState)
  }, [])

  /** The server said 401 to some other request: the session is gone. */
  const markExpired = useCallback(() => {
    verified = null
    setAdminSessionHint(false)
    setState({ status: 'unauthenticated' })
  }, [])

  const signOut = useCallback(async () => {
    verified = null
    setAdminSessionHint(false)
    try {
      await apiPost('/auth/admin/logout', {})
    } catch (err) {
      if (!(err instanceof ApiNetworkError)) throw err
    } finally {
      setState({ status: 'unauthenticated' })
    }
  }, [])

  return { ...state, refresh, markExpired, signOut }
}
