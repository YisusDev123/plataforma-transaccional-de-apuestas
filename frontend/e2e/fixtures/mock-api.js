import { expect } from '@playwright/test'
import { Buffer } from 'node:buffer'

const player = {
  id: 7,
  email: 'jugador@example.test',
  emailVerified: true,
  kycStatus: 'APPROVED',
  status: 'ACTIVE',
  fullName: 'Jugador Prueba',
  dni: '123456789',
}

const admin = { id: 2, email: 'empleado@example.test', role: 'EMPLOYEE', status: 'ACTIVE' }
const pagination = { currentPage: 1, totalPages: 1, totalItems: 1, limit: 20 }
const draw = {
  draw_id: 41,
  lottery: 'TICA',
  modality: 'NORMAL',
  draw_date: '2026-09-03',
  schedule_time: '19:30:00',
  close_at: '2026-09-04T01:25:00.000Z',
  status: 'OPEN',
  payout_multiplier: '80.00',
  payout_rule_version: 1,
}

function json(body, status = 200, headers = {}) {
  return { status, contentType: 'application/json', headers: { 'x-correlation-id': 'e2e-correlation', ...headers }, body: JSON.stringify({ body }) }
}

function unauthorized() {
  return json({ code: 'UNAUTHORIZED', message: 'Sesión requerida.' }, 401)
}

function minimalPdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length 44 >>\nstream\nBT /F1 18 Tf 72 720 Td (Receipt) Tj ET\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let value = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(value))
    value += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(value)
  value += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  value += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  value += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(value)
}

function pdf(ticketCode = 'TICKET-501') {
  return {
    status: 200,
    contentType: 'application/pdf',
    headers: {
      'content-disposition': `inline; filename="comprobante-${ticketCode}.pdf"`,
      'cache-control': 'private, no-store',
      'access-control-expose-headers': 'Content-Disposition',
    },
    body: minimalPdf(),
  }
}

export async function installMockApi(page, options = {}) {
  const state = {
    playerAuthenticated: options.playerAuthenticated ?? false,
    adminAuthenticated: options.adminAuthenticated ?? false,
    role: options.role || 'EMPLOYEE',
    kycStatus: options.kycStatus || 'APPROVED',
    requests: [],
    overrides: options.overrides || {},
    depositDestinations: [
      { id: 21, type: 'BANK_ACCOUNT', destinationValue: 'CR00000000000000000000', accountHolder: 'Comercio Demo', version: 2, createdAt: '2026-09-06T12:00:00Z' },
      { id: 22, type: 'SINPE_MOVIL', destinationValue: '88888888', accountHolder: 'Comercio Demo', version: 4, createdAt: '2026-09-06T12:00:00Z' },
    ],
    selectedDepositDestinationId: null,
  }

  await page.route('**/*', async (route) => {
    const request = route.request()
    if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue()
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:3000') return route.continue()
    const key = `${request.method()} ${url.pathname}`
    const entry = { key, path: url.pathname, method: request.method(), body: request.postDataJSON?.() ?? null }
    state.requests.push(entry)

    const override = state.overrides[key] || state.overrides[url.pathname]
    if (override) {
      const result = typeof override === 'function' ? await override({ request, state, entry }) : override
      return route.fulfill(result.status ? result : json(result))
    }

    if (url.pathname === '/auth/me') return route.fulfill(state.playerAuthenticated ? json({
      ...player,
      kycStatus: state.kycStatus,
      fullName: state.kycStatus === 'NO_KYC' ? null : player.fullName,
      dni: state.kycStatus === 'NO_KYC' ? null : player.dni,
    }) : unauthorized())
    if (url.pathname === '/auth/refresh') return route.fulfill(state.playerAuthenticated ? json({ accessToken: 'player-memory-token' }) : unauthorized())
    if (url.pathname === '/auth/login') { state.playerAuthenticated = true; return route.fulfill(json({ accessToken: 'player-memory-token' })) }
    if (url.pathname === '/auth/logout') { state.playerAuthenticated = false; return route.fulfill(json({ message: 'Sesión cerrada.' })) }
    if (url.pathname === '/kyc/submit') { state.kycStatus = 'PENDING'; return route.fulfill(json({ message: 'Información recibida.' }, 201)) }
    if (url.pathname === '/admin/me') return route.fulfill(state.adminAuthenticated ? json({ ...admin, role: state.role }) : unauthorized())
    if (url.pathname === '/admin/refresh') return route.fulfill(state.adminAuthenticated ? json({ accessToken: 'admin-memory-token' }) : unauthorized())
    if (url.pathname === '/admin/login') { state.adminAuthenticated = true; return route.fulfill(json({ accessToken: 'admin-memory-token' })) }
    if (url.pathname === '/admin/logout') { state.adminAuthenticated = false; return route.fulfill(json({ message: 'Sesión cerrada.' })) }

    if (url.pathname === '/wallet/balance') return route.fulfill(json({ available_balance: '25000.50', held_balance: '1250.00' }))
    if (url.pathname === '/wallet/transactions') return route.fulfill(json({ transacciones: [], pagination: { ...pagination, limit: 5, totalItems: 0 } }))
    if (url.pathname === '/wallet/operation-rules') return route.fulfill(json({ deposit: { minimum: '1000.00', requiresKyc: true, destinations: [{ id: 21, type: 'BANK_ACCOUNT', destinationValue: 'CR00000000000000000000', accountHolder: 'Comercio Demo', version: 2 }, { id: 22, type: 'SINPE_MOVIL', destinationValue: '88888888', accountHolder: 'Comercio Demo', version: 4 }] }, withdrawal: { minimum: '2000.00', requiresKyc: true } }))
    if (url.pathname === '/deposits/create') { state.selectedDepositDestinationId = entry.body?.destinationId; return route.fulfill(json({ id: 9, status: 'PENDING', requestId: entry.body?.requestId }, 201)) }
    if (url.pathname === '/deposits/9') return route.fulfill(json({ id: 9, amount: '1500.00', referenceNumber: 'REF-9', requestId: 'e2e-deposit', status: 'PENDING', destination: state.depositDestinations.find((item) => item.id === state.selectedDepositDestinationId) || state.depositDestinations[0], createdAt: '2026-09-06T12:00:00Z' }))
    if (url.pathname === '/draw/open') return route.fulfill(json({ sales_enabled: true, draws: [draw], bet_rules: { min_bet_per_number: '100.00', max_ticket_total: '10000.00' } }))
    if (/^\/draw\/\d+\/availability$/.test(url.pathname)) return route.fulfill(json({ draw, numbers: Array.from({ length: 100 }, (_, index) => ({ number: String(index).padStart(2, '0'), available: true, remaining_amount: '5000.00' })) }))
    if (url.pathname === '/bet/place') return route.fulfill(json({ bet_id: 501, request_id: entry.body?.request_id, total_amount: '100.00', status: 'PENDING' }, 201))
    if (url.pathname === '/bet/501') return route.fulfill(json({ id: 501, ticketCode: 'TICKET-501', requestId: 'e2e-request', totalAmount: '100.00', status: 'PENDING', receiptAvailable: true, createdAt: '2026-09-02T15:00:00.000Z', items: [{ id: 1, draw: { id: 41, lottery: 'TICA', modality: 'NORMAL', drawDate: '2026-09-03', scheduleTime: '19:30:00', status: 'OPEN', winningNumber: null }, numberPlayed: '00', amount: '100.00', multiplierSnapshot: '80.00', status: 'PENDING', payoutProcessed: false, potentialPayout: '8000.00', payoutAmount: '0.00' }] }))
    if (url.pathname === '/bet/501/receipt') return route.fulfill(pdf())
    if (url.pathname === '/bet/history') return route.fulfill(json({ tickets: [], pagination: { ...pagination, totalItems: 0, limit: 10 } }))

    if (url.pathname === '/admin/summary') return route.fulfill(json({ pending_kyc: 2, pending_deposits: 1, pending_withdrawals: 1, closed_draws: 1, system_status: { maintenance_mode: false, sales_enabled: true } }))
    if (url.pathname === '/admin/deposit-destination') {
      if (request.method() === 'PUT') {
        const next = { id: 30 + state.depositDestinations.length, ...entry.body, version: Math.max(0, ...state.depositDestinations.filter((item) => item.type === entry.body.type).map((item) => item.version)) + 1, createdAt: '2026-09-06T13:00:00Z' }
        state.depositDestinations = [...state.depositDestinations.filter((item) => item.type !== next.type), next]
        return route.fulfill(json({ message: 'Actualizado', destination: next }))
      }
      return route.fulfill(json({ destinations: state.depositDestinations }))
    }
    if (url.pathname === '/admin/get-deposits') return route.fulfill(json({ deposits: [{ id: 9, user_id: 7, email: player.email, full_name: 'Jugador Prueba', reference_number: 'REF-MASKED', amount: '1500.00', status: 'PENDING', destination_id: 21, destination_type: 'BANK_ACCOUNT', destination_value: 'CR00000000000000000000', account_holder: 'Comercio Demo', destination_version: 2, created_at: '2026-09-02T15:00:00.000Z' }], pagination }))
    if (url.pathname === '/admin/9/approve-deposits') return route.fulfill(json({ id: 9, status: 'APPROVED' }))
    if (url.pathname === '/draw/admin') return route.fulfill(json({ draws: [{ ...draw, status: 'CLOSED', result_number: null }], pagination }))
    if (url.pathname === '/draw/admin/41/limits') return route.fulfill(json({ draw, numbers: Array.from({ length: 100 }, (_, index) => ({ number: String(index).padStart(2, '0'), max_amount: '5000.00', current_amount: index === 0 ? '5000.00' : '0.00', remaining_amount: index === 0 ? '0.00' : '5000.00' })) }))
    if (url.pathname === '/numberLimit/max-amount') return route.fulfill(json({ draw_id: 41, number_played: '00', previous_max_amount: '5000.00', new_max_amount: '6000.00', current_amount: '5000.00', remaining_amount: '1000.00' }))
    if (url.pathname === '/draw/results') return route.fulfill(json({ processed: 1 }))
    if (url.pathname === '/admin/getUsers') return route.fulfill(json({ users: [], pagination: { ...pagination, totalItems: 0 } }))
    if (url.pathname === '/admin/kyc/request') return route.fulfill(json({ kycs: [], pagination: { ...pagination, totalItems: 0 } }))
    if (url.pathname === '/admin/get-Withdrawals') return route.fulfill(json({ withdrawals: [], pagination: { ...pagination, totalItems: 0 } }))
    if (url.pathname === '/rules') return route.fulfill(json({ system_status: { maintenance_mode: false, sales_enabled: true, message: '' }, financial_rules: { min_bet_per_number: '100.00', max_ticket_total: '10000.00' } }))
    if (url.pathname === '/admin/payout-rules') return route.fulfill(json({ rules: [{ id: 4, lottery: 'NICA', modality: 'NORMAL', multiplier: '85.00', isActive: true, version: 3, updatedAt: '2026-09-05T12:00:00Z' }] }))
    if (url.pathname === '/admin/payout-rules/4') return route.fulfill(json({ rule: { id: 4, lottery: 'NICA', modality: 'NORMAL', multiplier: '90.25', isActive: true, version: 4 } }))
    if (url.pathname === '/admin/bets') return route.fulfill(json({ tickets: [{ id: 501, ticketCode: 'TICKET-501', customerName: 'Jugador Prueba', totalAmount: '100.00', status: 'CONFIRMED', itemCount: 1, receiptAvailable: true, createdAt: '2026-09-02T15:00:00.000Z' }], pagination }))
    if (url.pathname === '/admin/bets/501') return route.fulfill(json({ id: 501, userId: 7, customerName: 'Jugador Prueba', ticketCode: 'TICKET-501', totalAmount: '100.00', status: 'CONFIRMED', receiptAvailable: true, createdAt: '2026-09-02T15:00:00.000Z', items: [{ id: 1, draw: { id: 41, lottery: 'TICA', modality: 'NORMAL', drawDate: '2026-09-03', scheduleTime: '19:30:00', status: 'OPEN', winningNumber: null }, numberPlayed: '00', amount: '100.00', multiplierSnapshot: '80.00', status: 'ACTIVE', payoutProcessed: false, potentialPayout: '8000.00', payoutAmount: '0.00' }] }))
    if (url.pathname === '/admin/bets/501/receipt') return route.fulfill(pdf())
    if (url.pathname === '/admin/getAdmins') return route.fulfill(json({ admins: [] }))

    return route.fulfill(json({}))
  })

  return state
}

export function mutationCount(state, path) {
  return state.requests.filter((entry) => entry.path === path && !['GET', 'HEAD'].includes(entry.method)).length
}

export async function expectNoPersistentTokens(page) {
  const storage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }))
  expect(JSON.stringify(storage)).not.toContain('memory-token')
  expect(JSON.stringify(storage)).not.toMatch(/access[_-]?token|refresh[_-]?token/i)
}
