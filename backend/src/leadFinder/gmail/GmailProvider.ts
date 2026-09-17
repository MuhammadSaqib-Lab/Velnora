import { randomUUID } from 'node:crypto'
import { google } from 'googleapis'
import { env } from '../../config/env.js'

/**
 * Gmail integration — DRAFT CREATION ONLY. This file has no send method
 * of any kind (not "a send method that's never called," there simply is
 * no code path here that can call Gmail's send endpoint at all).
 *
 * `gmail.compose` is the minimum available Gmail API scope that permits
 * draft creation. Google's own scope description for it also covers
 * sending messages/drafts via the API — there is no narrower official
 * scope that grants drafts.create without also nominally permitting
 * send. The actual enforcement here is architectural (no send code
 * exists), not scope-based; documented honestly rather than claiming a
 * "drafts-only scope" that doesn't exist. See backend/README.md's
 * "Gmail OAuth setup" section.
 */
const SCOPES = ['https://www.googleapis.com/auth/gmail.compose']

function getOAuthClient() {
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI)
}

export function isGmailConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI)
}

export function isGmailReadyToDraft(): boolean {
  return isGmailConfigured() && Boolean(env.GOOGLE_REFRESH_TOKEN)
}

/**
 * Google's redirect back to /oauth-callback is a plain browser
 * navigation — it cannot carry our X-Admin-Token header, so that route
 * is deliberately NOT behind requireAdminToken.ts (see leads.routes.ts).
 * This one-time, in-memory `state` value is the CSRF defense instead: it
 * only exists for the few seconds between an admin-token-authenticated
 * call to /auth-url and the resulting callback, is single-use, and a
 * mismatched or missing state is refused outright. Module-level state is
 * fine here — this is a single-operator, one-time setup action, not a
 * concurrent multi-user flow.
 */
let pendingOAuthState: string | null = null

/** Step 1 of the one-time setup flow: a URL the human owner visits and
 * signs into their own Gmail account with. See GET /api/leads/gmail/auth-url. */
export function generateAuthUrl(): string {
  if (!isGmailConfigured()) {
    throw new Error('Gmail OAuth is not configured (missing GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)')
  }
  const client = getOAuthClient()
  pendingOAuthState = randomUUID()
  return client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state: pendingOAuthState })
}

/** Step 2: exchanges the one-time authorization code Google redirects
 * back with for a long-lived refresh token, after checking `state`
 * matches what /auth-url just issued. The caller (the oauth callback
 * route) is responsible for surfacing the token to the owner to copy
 * into .env as GOOGLE_REFRESH_TOKEN — this function does not persist it
 * anywhere itself. */
export async function exchangeCodeForRefreshToken(code: string, state: string): Promise<string> {
  if (!isGmailConfigured()) {
    throw new Error('Gmail OAuth is not configured (missing GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)')
  }
  if (!pendingOAuthState || state !== pendingOAuthState) {
    throw new Error('Invalid or expired OAuth state. Start over at GET /api/leads/gmail/auth-url.')
  }
  pendingOAuthState = null // one-time use, even on failure below

  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. This usually means access was already granted once before — revoke Velnora\'s access at https://myaccount.google.com/permissions and try the auth-url flow again.',
    )
  }
  return tokens.refresh_token
}

const HEADER_INJECTION_PATTERN = /[\r\n]/

/**
 * Creates a Gmail draft addressed to `to` and returns its draft id. `to`
 * is always the lead's own stored, previously-verified email — this
 * function never accepts an arbitrary recipient from a request body, see
 * the caller in aiChat.service.ts-equivalent (leadFinder.service.ts).
 * `subject`/`body` are rejected outright if they contain a raw CR/LF,
 * which would otherwise let AI-generated text (indirectly influenced by
 * scraped web content) inject additional MIME headers.
 */
export async function createDraft(params: { to: string; subject: string; body: string }): Promise<string> {
  if (!isGmailReadyToDraft()) {
    throw new Error('Gmail is not configured (missing GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI/REFRESH_TOKEN)')
  }
  if (HEADER_INJECTION_PATTERN.test(params.to) || HEADER_INJECTION_PATTERN.test(params.subject)) {
    throw new Error('Refusing to create a draft: recipient or subject contains a line break')
  }

  const client = getOAuthClient()
  client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN })
  const gmail = google.gmail({ version: 'v1', auth: client })

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw: buildRawMessage(params) } },
  })

  const draftId = response.data.id
  if (!draftId) throw new Error('Gmail did not return a draft id')
  return draftId
}

function buildRawMessage({ to, subject, body }: { to: string; subject: string; body: string }): string {
  const message = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n')

  return Buffer.from(message, 'utf-8').toString('base64url')
}
