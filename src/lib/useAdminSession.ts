import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, ApiNetworkError } from '@/lib/api'

export interface AdminSessionUser {
  id: string
  email: string
}

type AdminSessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; admin: AdminSessionUser }
  | { status: 'unauthenticated' }

/**
 * Backs every /internal/admin/* page's auth check. Session state lives
 * entirely server-side (an httpOnly cookie the browser attaches
 * automatically, see src/lib/api.ts's `credentials: 'include'`) — this
 * hook never stores a token itself, it just asks the server "am I
 * logged in" via GET /api/auth/admin/me and reacts to the answer.
 */
function fetchSession(): Promise<AdminSessionState> {
  return apiGet<{ admin: AdminSessionUser }>('/auth/admin/me')
    .then((res): AdminSessionState =>
      res.success && res.data ? { status: 'authenticated', admin: res.data.admin } : { status: 'unauthenticated' },
    )
    .catch((): AdminSessionState => ({ status: 'unauthenticated' }))
}

export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>({ status: 'loading' })

  // Initial check on mount — `state` already starts as 'loading', so no
  // redundant setState is needed before kicking off the request.
  useEffect(() => {
    let cancelled = false
    fetchSession().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // For explicit re-checks after an action (e.g. right after a
  // successful login) — called from event handlers, never from an effect.
  const refresh = useCallback(() => {
    setState({ status: 'loading' })
    fetchSession().then(setState)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiPost('/auth/admin/logout', {})
    } catch (err) {
      if (!(err instanceof ApiNetworkError)) throw err
    } finally {
      setState({ status: 'unauthenticated' })
    }
  }, [])

  return { ...state, refresh, signOut }
}
