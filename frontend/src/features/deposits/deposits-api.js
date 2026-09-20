import { apiRequest } from '../../shared/api/http-client.js'
import { queryString } from '../../shared/api/query-string.js'
import { financialPost } from '../financial-intent/financial-request.js'

export const depositsApi = {
  list: (filters) => apiRequest(`/deposits${queryString(filters)}`),
  detail: (id) => apiRequest(`/deposits/${id}`),
  create: (input) => financialPost('/deposits/create', input),
}

export const depositKeys = {
  all: ['deposits'],
  list: (filters) => [...depositKeys.all, 'list', filters],
  detail: (id) => [...depositKeys.all, 'detail', String(id)],
}
