import { apiRequest } from '../../shared/api/http-client.js'
import { queryString } from '../../shared/api/query-string.js'

export const walletApi = {
  balance: () => apiRequest('/wallet/balance'),
  operationRules: () => apiRequest('/wallet/operation-rules'),
  transactions: ({ page = 1, limit = 10 } = {}) => apiRequest(`/wallet/transactions${queryString({ page, limit })}`),
}

export const walletKeys = {
  all: ['wallet'],
  balance: () => [...walletKeys.all, 'balance'],
  operationRules: () => [...walletKeys.all, 'operation-rules'],
  transactions: (filters) => [...walletKeys.all, 'transactions', filters],
}
