import { apiRequest } from '../../shared/api/http-client.js'

export const drawsApi = {
  open: () => apiRequest('/draw/open'),
  availability: (id) => apiRequest(`/draw/${id}/availability`),
}

export const drawKeys = {
  all: ['draws'],
  open: () => [...drawKeys.all, 'open'],
  availability: (id) => [...drawKeys.all, 'availability', String(id)],
}
