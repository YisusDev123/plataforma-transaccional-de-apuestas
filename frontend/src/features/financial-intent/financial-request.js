import { apiRequest } from '../../shared/api/http-client.js'

const FINANCIAL_TIMEOUT_MS = 20_000

export async function financialPost(path, body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FINANCIAL_TIMEOUT_MS)
  try {
    return await apiRequest(path, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    }, { retryAuthentication: true })
  } finally {
    clearTimeout(timeout)
  }
}

export function isUncertainFinancialError(error) {
  return error?.code === 'NETWORK_ERROR' || error?.status >= 500
}
