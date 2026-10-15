/**
 * Tiny event bus between the API layer and the admin sidebar counts.
 *
 * Any successful write to the admin (or Lead Finder) API can change what is
 * "waiting for an admin" — approving a review, changing a project's status,
 * generating a draft — so api.ts announces it here and the counts poller
 * refreshes straight away instead of waiting for its next periodic poll.
 * Nothing in the payload: listeners just re-ask the server for the numbers.
 */
export const ADMIN_DATA_CHANGED = 'velnora:admin-data-changed'

export function notifyAdminDataChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ADMIN_DATA_CHANGED))
}

/** Which API paths count as admin data (everything the dashboard reads or writes). */
export function isAdminDataPath(path: string): boolean {
  return path.startsWith('/admin/') || path.startsWith('/leads')
}

/**
 * Fired when an admin API call is answered with 401: the session is gone (it
 * expired or was ended elsewhere). AdminShell listens and sends the admin to
 * the login page instead of leaving an "Unauthorized" message on some page.
 */
export const ADMIN_SESSION_REJECTED = 'velnora:admin-session-rejected'

export function notifyAdminSessionRejected(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ADMIN_SESSION_REJECTED))
}
