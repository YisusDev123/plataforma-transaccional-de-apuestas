import { apiRequest } from '../../shared/api/http-client.js'

export const kycApi = {
  submit: (input) => apiRequest('/kyc/submit', {
    method: 'POST',
    body: JSON.stringify(input),
  }, { retryAuthentication: false }),
}
