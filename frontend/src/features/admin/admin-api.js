import { apiRequest, apiRequestBlob } from '../../shared/api/http-client.js'
import { queryString } from '../../shared/api/query-string.js'

const config = { scope: 'admin' }
const request = (path, options) => apiRequest(path, options, config)
const body = (method, value) => ({ method, body: JSON.stringify(value ?? {}) })

export const adminApi = {
  summary: () => request('/admin/summary'),
  users: (filters) => request(`/admin/getUsers${queryString(filters)}`),
  suspendUser: (userId, reason) => request('/admin/users/suspend', body('PATCH', { userId, reason })),
  reactivateUser: (id) => request(`/admin/users/${id}/user-Reactivate`, body('PATCH')),
  kycs: (filters) => request(`/admin/kyc/request${queryString(filters)}`),
  reviewKyc: (id, status, detalles) => request('/admin/kyc/review', body('PATCH', { id, status, detalles })),
  deposits: (filters) => request(`/admin/get-deposits${queryString(filters)}`),
  approveDeposit: (id) => request(`/admin/${id}/approve-deposits`, body('POST')),
  rejectDeposit: (id, reason) => request(`/admin/${id}/reject-deposits`, body('POST', { reason })),
  depositDestinations: () => request('/admin/deposit-destination'),
  updateDepositDestination: (value) => request('/admin/deposit-destination', body('PUT', value)),
  withdrawals: (filters) => request(`/admin/get-Withdrawals${queryString(filters)}`),
  approveWithdrawal: (id) => request(`/admin/${id}/approve-withdrawals`, body('POST')),
  rejectWithdrawal: (id, reason) => request(`/admin/${id}/reject-withdrawals`, body('POST', { reason })),
  draws: (filters) => request(`/draw/admin${queryString(filters)}`),
  drawList: (filters) => request(`/draw/admin/list${queryString(filters)}`),
  loadResults: (results) => request('/draw/results', body('POST', { results })),
  cancelDraw: (id) => request(`/draw/${id}/cancel`, body('PATCH')),
  limits: (id) => request(`/draw/admin/${id}/limits`),
  updateLimit: (value) => request('/numberLimit/max-amount', body('PUT', value)),
  settings: () => request('/rules'),
  updateSetting: (key, value) => request(`/rules/${key}`, body('PATCH', value)),
  payoutRules: () => request('/admin/payout-rules'),
  updatePayoutRule: (id, value) => request(`/admin/payout-rules/${id}`, body('PATCH', value)),
  bets: (filters) => request(`/admin/bets${queryString(filters)}`),
  bet: (id) => request(`/admin/bets/${id}`),
  betReceipt: (id) => apiRequestBlob(`/admin/bets/${id}/receipt`, {}, config),
  admins: () => request('/admin/getAdmins'),
  createAdmin: (value) => request('/admin/create', body('POST', value)),
  suspendAdmin: (id) => request(`/admin/${id}/suspend-admin`, body('POST')),
  reactivateAdmin: (id) => request(`/admin/${id}/reactivate-Admin`, body('PATCH')),
}

export const adminKeys = {
  all: ['admin'],
  summary: () => ['admin', 'summary'],
  users: (filters) => ['admin', 'users', filters],
  kycs: (filters) => ['admin', 'kycs', filters],
  deposits: (filters) => ['admin', 'deposits', filters],
  depositDestinations: () => ['admin', 'deposit-destinations'],
  withdrawals: (filters) => ['admin', 'withdrawals', filters],
  draws: (filters) => ['admin', 'draws', filters],
  drawList: (filters) => ['admin', 'draw-list', filters],
  limits: (id) => ['admin', 'limits', String(id)],
  settings: () => ['admin', 'settings'],
  payoutRules: () => ['admin', 'payout-rules'],
  bets: (filters) => ['admin', 'bets', filters],
  bet: (id) => ['admin', 'bets', String(id)],
  admins: () => ['admin', 'admins'],
}
