import { apiRequest, apiRequestBlob } from '../../shared/api/http-client.js'
import { queryString } from '../../shared/api/query-string.js'
import { financialPost } from '../financial-intent/financial-request.js'

export const betsApi = {
  list: (filters) => apiRequest(`/bet/history${queryString(filters)}`),
  detail: (id) => apiRequest(`/bet/${id}`),
  receipt: (id) => apiRequestBlob(`/bet/${id}/receipt`),
  place: (input) => financialPost('/bet/place', input),
}

export const betKeys = {
  all: ['bets'],
  list: (filters) => [...betKeys.all, 'list', filters],
  detail: (id) => [...betKeys.all, 'detail', String(id)],
}
