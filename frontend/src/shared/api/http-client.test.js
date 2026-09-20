import { afterEach, describe, expect, test, vi } from 'vitest'
import { setAccessToken } from '../../features/auth/session-store.js'
import { ApiError } from './ApiError.js'
import { apiRequest, apiRequestBlob } from './http-client.js'

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cliente HTTP', () => {
  test('envía credenciales y el access token conservado en memoria', async () => {
    setAccessToken('access-token')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      error: false,
      status: 200,
      body: { balance: '10.00' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/wallet/balance')).resolves.toEqual({ balance: '10.00' })
    const options = fetchMock.mock.calls[0][1]
    expect(options.credentials).toBe('include')
    expect(options.headers.get('Authorization')).toBe('Bearer access-token')
  })

  test('ante 401 rota la sesión una sola vez y repite la solicitud original', async () => {
    setAccessToken('expired')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: 'TOKEN_EXPIRED', message: 'Expiró' }))
      .mockResolvedValueOnce(jsonResponse(200, { body: { accessToken: 'renewed' } }))
      .mockResolvedValueOnce(jsonResponse(200, { body: { id: 8 } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/auth/me')).resolves.toEqual({ id: 8 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/)
    expect(fetchMock.mock.calls[2][1].headers.get('Authorization')).toBe('Bearer renewed')
  })

  test('dos 401 concurrentes comparten una sola rotación de refresh', async () => {
    setAccessToken('expired')
    let protectedCalls = 0
    let refreshCalls = 0
    const fetchMock = vi.fn(async (url) => {
      const path = new URL(url).pathname
      if (path === '/auth/refresh') {
        refreshCalls += 1
        await Promise.resolve()
        return jsonResponse(200, { body: { accessToken: 'renewed-once' } })
      }
      protectedCalls += 1
      if (protectedCalls <= 2) return jsonResponse(401, { message: 'Expiró' })
      return jsonResponse(200, { body: { ok: true } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(Promise.all([apiRequest('/auth/me'), apiRequest('/wallet/balance')])).resolves.toEqual([{ ok: true }, { ok: true }])
    expect(refreshCalls).toBe(1)
  })

  test('un conflicto financiero no se reintenta automáticamente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, {
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      message: 'El requestId ya fue utilizado.',
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/bet/place', {
      method: 'POST',
      body: JSON.stringify({ requestId: 'stable-id' }),
    })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(ApiError.prototype).toBeInstanceOf(Error)
  })

  test('descarga un PDF autenticado sin interpretar su contenido como JSON', async () => {
    setAccessToken('pdf-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response('%PDF-test', {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="comprobante-ABC.pdf"',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequestBlob('/bet/1/receipt')
    expect(result.filename).toBe('comprobante-ABC.pdf')
    expect(result.blob.type).toBe('application/pdf')
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer pdf-token')
  })
})
