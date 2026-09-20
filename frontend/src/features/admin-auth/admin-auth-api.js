import { apiRequest } from '../../shared/api/http-client.js'

function post(path, body = {}) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) }, { scope: 'admin', retryAuthentication: false })
}

export const adminAuthApi = {
  login: (credentials) => post('/admin/login', credentials),
  profile: (retryAuthentication = true) => apiRequest('/admin/me', {}, { scope: 'admin', retryAuthentication }),
  logout: () => post('/admin/logout'),
}
