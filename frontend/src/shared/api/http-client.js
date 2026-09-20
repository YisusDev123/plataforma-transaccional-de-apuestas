import { getAccessToken, invalidateAccessToken, setAccessToken } from '../../features/auth/session-store.js'
import { environment } from '../config/environment.js'
import { ApiError } from './ApiError.js'

const refreshRequests = new Map()

function refreshPath(scope) {
  return scope === 'admin' ? '/admin/refresh' : '/auth/refresh'
}

async function readPayload(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  return response.json()
}

function networkError(error) {
  if (error instanceof ApiError) return error
  return new ApiError('No pudimos conectar con el servicio. Revisa tu conexión e intenta nuevamente.', {
    code: 'NETWORK_ERROR',
  })
}

function toApiError(response, payload) {
  const body = payload?.body || payload || {}
  const message = body.message || payload?.message || 'No fue posible completar la solicitud.'
  return new ApiError(message, {
    status: response.status,
    code: body.code || payload?.code || 'REQUEST_FAILED',
    details: body.details || null,
    correlationId: response.headers.get('x-correlation-id') || body.correlationId || null,
  })
}

async function renewAccessToken(scope) {
  if (refreshRequests.has(scope)) return refreshRequests.get(scope)

  const pending = fetch(`${environment.apiBaseUrl}${refreshPath(scope)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then(async (response) => {
    const payload = await readPayload(response)
    const accessToken = payload?.body?.accessToken
    if (!response.ok || !accessToken) throw toApiError(response, payload)
    setAccessToken(accessToken, scope)
    return accessToken
  }).catch((error) => {
    invalidateAccessToken(scope)
    throw networkError(error)
  }).finally(() => {
    refreshRequests.delete(scope)
  })

  refreshRequests.set(scope, pending)
  return pending
}

export async function apiRequest(path, options = {}, config = {}) {
  const { scope = 'user', retryAuthentication = true } = config
  const headers = new Headers(options.headers)
  const token = getAccessToken(scope)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch(`${environment.apiBaseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch (error) {
    throw networkError(error)
  }
  const payload = await readPayload(response)

  if (response.status === 401 && retryAuthentication) {
    await renewAccessToken(scope)
    return apiRequest(path, options, { scope, retryAuthentication: false })
  }
  if (!response.ok) throw toApiError(response, payload)
  return payload?.body ?? payload
}

export async function apiRequestBlob(path, options = {}, config = {}) {
  const { scope = 'user', retryAuthentication = true } = config
  const headers = new Headers(options.headers)
  const token = getAccessToken(scope)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${environment.apiBaseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch (error) {
    throw networkError(error)
  }

  if (response.status === 401 && retryAuthentication) {
    await renewAccessToken(scope)
    return apiRequestBlob(path, options, { scope, retryAuthentication: false })
  }
  if (!response.ok) throw toApiError(response, await readPayload(response))

  const disposition = response.headers.get('content-disposition') || ''
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'comprobante.pdf'
  return { blob: await response.blob(), filename }
}

export function restoreSession(scope = 'user') {
  return renewAccessToken(scope)
}
