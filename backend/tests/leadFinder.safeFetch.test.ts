import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))

vi.mock('node:dns/promises', () => ({ lookup: lookupMock }))

const { safeFetchText } = await import('../src/leadFinder/security/safeFetch.js')

describe('safeFetchText: SSRF protections', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    lookupMock.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('refuses a non-http(s) protocol before ever resolving DNS or fetching', async () => {
    global.fetch = vi.fn()
    const result = await safeFetchText('file:///etc/passwd')
    expect(result).toBeNull()
    expect(lookupMock).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('refuses a URL with embedded credentials', async () => {
    global.fetch = vi.fn()
    const result = await safeFetchText('http://admin:password@example.com/')
    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('refuses "localhost" outright without a DNS lookup', async () => {
    global.fetch = vi.fn()
    const result = await safeFetchText('http://localhost:5432/')
    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('refuses a hostname that resolves to the cloud metadata address (169.254.169.254)', async () => {
    lookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }])
    global.fetch = vi.fn()
    const result = await safeFetchText('http://malicious-business-site.example/')
    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('refuses a hostname that resolves to a private RFC1918 address', async () => {
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    global.fetch = vi.fn()
    const result = await safeFetchText('http://internal.example/')
    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('refuses IPv6 loopback (::1)', async () => {
    lookupMock.mockResolvedValue([{ address: '::1', family: 6 }])
    global.fetch = vi.fn()
    const result = await safeFetchText('http://sneaky.example/')
    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('allows a hostname that resolves to a genuine public address', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const mockResponse = new Response('<html><title>Hi</title></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const result = await safeFetchText('http://a-real-business.example/')
    expect(result).not.toBeNull()
    expect(result?.status).toBe(200)
    expect(result?.text).toContain('<title>Hi</title>')
  })

  it('does not follow a redirect to a disallowed target without re-validating it', async () => {
    lookupMock
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]) // first hop: public, fine
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]) // redirect target: loopback

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://internal-service.example/' } }),
    )

    const result = await safeFetchText('http://a-real-business.example/')
    expect(result).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1) // never actually fetched the redirect target
  })

  it('gives up after too many redirects rather than looping forever', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://a-real-business.example/next' } }),
    )
    const result = await safeFetchText('http://a-real-business.example/')
    expect(result).toBeNull()
  })

  it('rejects a response whose Content-Length exceeds the size cap', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    global.fetch = vi.fn().mockResolvedValue(
      new Response('x', { status: 200, headers: { 'content-length': String(10 * 1024 * 1024) } }),
    )
    const result = await safeFetchText('http://a-real-business.example/')
    expect(result).toBeNull()
  })

  it('returns null (not a throw) when the site is simply unreachable', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'))
    global.fetch = vi.fn()
    const result = await safeFetchText('http://this-domain-does-not-resolve.example/')
    expect(result).toBeNull()
  })
})
