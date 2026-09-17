import { beforeEach, describe, expect, it, vi } from 'vitest'

const { draftsCreateMock, messagesSendMock, draftsSendMock, getTokenMock } = vi.hoisted(() => ({
  draftsCreateMock: vi.fn(),
  messagesSendMock: vi.fn(),
  draftsSendMock: vi.fn(),
  getTokenMock: vi.fn(),
}))

class MockOAuth2 {
  generateAuthUrl({ state }: { state: string }) {
    return `https://accounts.google.com/o/oauth2/auth?state=${state}`
  }
  getToken(...args: unknown[]) {
    return getTokenMock(...args)
  }
  setCredentials() {
    // no-op
  }
}

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: MockOAuth2 },
    gmail: vi.fn().mockReturnValue({
      users: {
        drafts: { create: draftsCreateMock, send: draftsSendMock },
        messages: { send: messagesSendMock },
      },
    }),
  },
}))

describe('GmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4000/api/leads/gmail/oauth-callback'
    delete process.env.GOOGLE_REFRESH_TOKEN
  })

  it('reports not configured when GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI are unset', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const { isGmailConfigured, isGmailReadyToDraft } = await import('../src/leadFinder/gmail/GmailProvider.js')
    expect(isGmailConfigured()).toBe(false)
    expect(isGmailReadyToDraft()).toBe(false)
  })

  it('reports configured-but-not-ready-to-draft without a refresh token', async () => {
    const { isGmailConfigured, isGmailReadyToDraft } = await import('../src/leadFinder/gmail/GmailProvider.js')
    expect(isGmailConfigured()).toBe(true)
    expect(isGmailReadyToDraft()).toBe(false)
  })

  it('createDraft throws (never silently succeeds) when not ready to draft', async () => {
    const { createDraft } = await import('../src/leadFinder/gmail/GmailProvider.js')
    await expect(createDraft({ to: 'a@example.com', subject: 'Hi', body: 'Body' })).rejects.toThrow(/not configured/i)
    expect(draftsCreateMock).not.toHaveBeenCalled()
  })

  it('generateAuthUrl embeds a fresh one-time state, and exchangeCodeForRefreshToken rejects a mismatched state', async () => {
    const { generateAuthUrl, exchangeCodeForRefreshToken } = await import('../src/leadFinder/gmail/GmailProvider.js')
    const url = generateAuthUrl()
    expect(url).toContain('state=')

    await expect(exchangeCodeForRefreshToken('some-code', 'wrong-state')).rejects.toThrow(/invalid or expired oauth state/i)
    expect(getTokenMock).not.toHaveBeenCalled()
  })

  it('exchangeCodeForRefreshToken succeeds with the matching state and returns the refresh token', async () => {
    const { generateAuthUrl, exchangeCodeForRefreshToken } = await import('../src/leadFinder/gmail/GmailProvider.js')
    const url = generateAuthUrl()
    const state = new URL(url).searchParams.get('state') as string
    getTokenMock.mockResolvedValue({ tokens: { refresh_token: 'refresh-abc' } })

    const token = await exchangeCodeForRefreshToken('some-code', state)
    expect(token).toBe('refresh-abc')
  })

  it('exchangeCodeForRefreshToken is single-use — the same state cannot be replayed', async () => {
    const { generateAuthUrl, exchangeCodeForRefreshToken } = await import('../src/leadFinder/gmail/GmailProvider.js')
    const url = generateAuthUrl()
    const state = new URL(url).searchParams.get('state') as string
    getTokenMock.mockResolvedValue({ tokens: { refresh_token: 'refresh-abc' } })

    await exchangeCodeForRefreshToken('code-1', state)
    await expect(exchangeCodeForRefreshToken('code-2', state)).rejects.toThrow(/invalid or expired oauth state/i)
  })

  it('throws a clear error when Google does not return a refresh token', async () => {
    const { generateAuthUrl, exchangeCodeForRefreshToken } = await import('../src/leadFinder/gmail/GmailProvider.js')
    const url = generateAuthUrl()
    const state = new URL(url).searchParams.get('state') as string
    getTokenMock.mockResolvedValue({ tokens: {} })

    await expect(exchangeCodeForRefreshToken('code', state)).rejects.toThrow(/did not return a refresh token/i)
  })

  describe('with a refresh token configured', () => {
    beforeEach(() => {
      process.env.GOOGLE_REFRESH_TOKEN = 'refresh-token'
    })

    it('creates a draft and returns its id, calling ONLY drafts.create — never a send method', async () => {
      draftsCreateMock.mockResolvedValue({ data: { id: 'draft_123' } })
      const { createDraft } = await import('../src/leadFinder/gmail/GmailProvider.js')

      const draftId = await createDraft({ to: 'owner@example.com', subject: 'A practical idea', body: 'Hello there.' })

      expect(draftId).toBe('draft_123')
      expect(draftsCreateMock).toHaveBeenCalledTimes(1)
      expect(draftsCreateMock.mock.calls[0]?.[0]).toMatchObject({ userId: 'me' })
      expect(messagesSendMock).not.toHaveBeenCalled()
      expect(draftsSendMock).not.toHaveBeenCalled()
    })

    it('encodes the raw MIME message with the correct recipient and body', async () => {
      draftsCreateMock.mockResolvedValue({ data: { id: 'draft_1' } })
      const { createDraft } = await import('../src/leadFinder/gmail/GmailProvider.js')

      await createDraft({ to: 'owner@example.com', subject: 'Subject line', body: 'Body text here.' })

      const raw = draftsCreateMock.mock.calls[0]?.[0]?.requestBody?.message?.raw as string
      const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
      expect(decoded).toContain('To: owner@example.com')
      expect(decoded).toContain('Body text here.')
    })

    it('refuses to create a draft when the recipient contains a line break (header injection attempt)', async () => {
      const { createDraft } = await import('../src/leadFinder/gmail/GmailProvider.js')
      await expect(
        createDraft({ to: 'victim@example.com\r\nBcc: attacker@evil.example', subject: 'Hi', body: 'Body' }),
      ).rejects.toThrow(/line break/i)
      expect(draftsCreateMock).not.toHaveBeenCalled()
    })

    it('refuses to create a draft when the AI-generated subject contains a line break', async () => {
      const { createDraft } = await import('../src/leadFinder/gmail/GmailProvider.js')
      await expect(
        createDraft({ to: 'owner@example.com', subject: 'Hi\r\nBcc: attacker@evil.example', body: 'Body' }),
      ).rejects.toThrow(/line break/i)
      expect(draftsCreateMock).not.toHaveBeenCalled()
    })

    it('propagates a Gmail API failure as a rejected promise, never a fabricated success', async () => {
      draftsCreateMock.mockRejectedValue(new Error('invalid_grant'))
      const { createDraft } = await import('../src/leadFinder/gmail/GmailProvider.js')
      await expect(createDraft({ to: 'owner@example.com', subject: 'Hi', body: 'Body' })).rejects.toThrow('invalid_grant')
    })
  })
})
