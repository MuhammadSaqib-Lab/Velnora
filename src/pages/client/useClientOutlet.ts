import { useOutletContext } from 'react-router-dom'
import type { ClientAccount } from '@/lib/useClientSession'

export interface ClientOutletContext {
  client: ClientAccount
  /** Call when an API request returns 401 — sends the user back to log in. */
  onUnauthorized: () => void
}

export function useClientOutlet() {
  return useOutletContext<ClientOutletContext>()
}
