import { useState } from 'react'

/**
 * Shared by every /internal/* page (the Lead Finder test page and the
 * Phase 5 Admin Dashboard) — there is no real per-user auth system yet
 * (Phase 3), so every internal page's only "login" is entering the same
 * shared secret the backend's requireAdminToken.ts checks, stored in
 * sessionStorage (not localStorage, so it doesn't persist across browser
 * restarts) and sent as X-Admin-Token on every request. Anyone without
 * it gets 401s from the API regardless of what a page renders — this
 * hook only manages the token's client-side storage, it enforces
 * nothing on its own.
 */
const TOKEN_STORAGE_KEY = 'velnora_admin_token'

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // Best-effort only — the page still works, just re-prompts next visit.
  }
}

export function useAdminToken() {
  const [token, setTokenState] = useState(readStoredToken)

  function setToken(next: string) {
    storeToken(next)
    setTokenState(next)
  }

  function signOut() {
    setToken('')
  }

  return { token, setToken, signOut, headers: { 'X-Admin-Token': token } }
}
