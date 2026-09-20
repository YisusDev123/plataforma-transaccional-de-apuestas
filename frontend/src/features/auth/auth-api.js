import { apiRequest } from '../../shared/api/http-client.js'

function post(path, body) {
  return apiRequest(path, {
    method: 'POST',
    body: JSON.stringify(body),
  }, { retryAuthentication: false })
}

export const authApi = {
  register: (input) => post('/auth/register', input),
  login: (input) => post('/auth/login', input),
  verifyEmail: (input) => post('/auth/verify-email', input),
  resendVerification: (input) => post('/auth/resend-verification', input),
  forgotPassword: (input) => post('/auth/forgot-password', input),
  resetPassword: (input) => post('/auth/reset-password', input),
  getProfile: (retryAuthentication = true) => apiRequest('/auth/me', {}, { retryAuthentication }),
  logout: () => post('/auth/logout', {}),
}
