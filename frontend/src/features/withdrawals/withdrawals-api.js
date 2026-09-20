import { apiRequest } from '../../shared/api/http-client.js'
import { queryString } from '../../shared/api/query-string.js'
import { financialPost } from '../financial-intent/financial-request.js'

export const withdrawalsApi = {
  list: (filters) => apiRequest(`/withdrawals${queryString(filters)}`),
  detail: (id) => apiRequest(`/withdrawals/${id}`),
  create: (input) => financialPost('/withdrawals/request', input),
}

export const withdrawalKeys = {
  all: ['withdrawals'],
  list: (filters) => [...withdrawalKeys.all, 'list', filters],
  detail: (id) => [...withdrawalKeys.all, 'detail', String(id)],
}
