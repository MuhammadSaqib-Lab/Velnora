import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, ApiNetworkError } from '@/lib/api'

export interface ClientAccount {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
}

export type ClientSessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; client: ClientAccount }
  | { status: 'unauthenticated' }

/** Where signed-in clients land by default. */
export const CLIENT_HOME = '/client/projects'
export const NEW_PROJECT_PATH = '/client/projects/new'

/**
 * The post-login redirect target comes from a query string, so it is
 * attacker-influenced. Only same-site paths under /client are honored —
 * anything else (absolute URLs, `//host`, backslashes, other sections of
 * the site) falls back to the default, so a crafted link can't turn the
 * login page into an open redirect.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string = CLIENT_HOME): string {
  if (!raw || !raw.startsWith('/client')) return fallback
  if (raw.startsWith('//') || raw.includes('\\') || raw.includes('://') || hasControlChars(raw)) return fallback
  return raw
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) return true
  }
  return false
}

function fetchSession(): Promise<ClientSessionState> {
  return apiGet<{ client: ClientAccount }>('/client/session')
    .then((res): ClientSessionState =>
      res.success && res.data ? { status: 'authenticated', client: res.data.client } : { status: 'unauthenticated' },
    )
    .catch((): ClientSessionState => ({ status: 'unauthenticated' }))
}

/**
 * Client counterpart of useAdminSession: state lives entirely server-side
 * (an httpOnly cookie the browser attaches itself), this hook only asks
 * "am I logged in" via GET /api/client/session. No token is ever stored
 * in JS-readable storage. The backend re-verifies every request on its
 * own — redirecting on 'unauthenticated' is a UX convenience, not the
 * security boundary.
 */
export function useClientSession() {
  const [state, setState] = useState<ClientSessionState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchSession().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /** Called when any API call comes back 401 (session expired mid-visit). */
  const markUnauthenticated = useCallback(() => setState({ status: 'unauthenticated' }), [])

  const signOut = useCallback(async () => {
    try {
      await apiPost('/client/auth/logout', {})
    } catch (err) {
      if (!(err instanceof ApiNetworkError)) throw err
    } finally {
      setState({ status: 'unauthenticated' })
    }
  }, [])

  return { ...state, markUnauthenticated, signOut }
}

export type ClientSession = ReturnType<typeof useClientSession>
