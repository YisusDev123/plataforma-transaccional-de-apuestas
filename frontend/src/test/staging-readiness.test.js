import { describe, expect, test, vi } from 'vitest'
import { checkStagingReadiness } from '../../scripts/check-staging-readiness.mjs'

function response(body, { contentType = 'application/json', headers = {} } = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': contentType, ...headers } })
}

describe('gate de staging web', () => {
  test('rechaza destinos sin HTTPS', async () => {
    await expect(checkStagingReadiness({
      WEB_STAGING_URL: 'http://example.test',
      WEB_STAGING_API_URL: 'https://api.example.test',
    })).rejects.toThrow('HTTPS')
  })

  test('comprueba frontend, PWA, fallback, API, CORS y HSTS', async () => {
    const fetchMock = vi.fn(async (url) => {
      const parsed = new URL(url)
      if (parsed.pathname === '/manifest.webmanifest') {
        return response(JSON.stringify({ name: 'Loto', icons: [{ src: '/a' }, { src: '/b' }] }))
      }
      if (parsed.pathname === '/sw.js') return response('worker', { headers: { 'cache-control': 'no-cache' } })
      if (parsed.pathname === '/rules') return response('{}', { headers: { 'access-control-allow-origin': 'https://app.example.test' } })
      if (parsed.hostname === 'api.example.test') return response('{}')
      return response('<html></html>', { contentType: 'text/html', headers: { 'strict-transport-security': 'max-age=31536000' } })
    })
    await expect(checkStagingReadiness({
      WEB_STAGING_URL: 'https://app.example.test',
      WEB_STAGING_API_URL: 'https://api.example.test',
    }, fetchMock)).resolves.toEqual(expect.objectContaining({
      checked: expect.arrayContaining(['manifest', 'service_worker_headers', 'api_readiness', 'cors_exact_origin', 'hsts']),
    }))
  })
})
