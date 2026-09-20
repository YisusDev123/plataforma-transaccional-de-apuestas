import { webcrypto } from 'node:crypto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../App.jsx'
import { prepareIntent } from './intent-store.js'

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const destinations = [
  { id: 21, type: 'BANK_ACCOUNT', destinationValue: 'CR00000000000000000000', accountHolder: 'Comercio Demo', version: 2 },
  { id: 22, type: 'SINPE_MOVIL', destinationValue: '88888888', accountHolder: 'Comercio Demo', version: 4 },
]

function financialFetch({ kycStatus = 'APPROVED', depositDestinations = destinations, onDeposit, onDepositList, onWithdrawal } = {}) {
  return vi.fn(async (url, options = {}) => {
    const parsed = new URL(url)
    const path = parsed.pathname
    if (path === '/auth/refresh') return jsonResponse(200, { body: { accessToken: 'financial-access' } })
    if (path === '/auth/me') return jsonResponse(200, { body: { id: 7, email: 'jugador@example.com', emailVerified: true, status: 'ACTIVE', kycStatus } })
    if (path === '/wallet/operation-rules') return jsonResponse(200, { body: { deposit: { minimum: '100.00', requiresKyc: true, destinations: depositDestinations }, withdrawal: { minimum: '200.00', requiresKyc: true } } })
    if (path === '/wallet/balance') return jsonResponse(200, { body: { id: 2, available_balance: '1000.00', held_balance: '0.00' } })
    if (path === '/deposits/create') return onDeposit ? onDeposit(parsed, options) : jsonResponse(201, { body: { id: 9, status: 'PENDING', requestId: 'request' } })
    if (path === '/withdrawals/request') return onWithdrawal ? onWithdrawal(parsed, options) : jsonResponse(201, { body: { id: 8, status: 'PENDING', requestId: 'request' } })
    if (path === '/deposits/9') return jsonResponse(200, { body: { id: 9, amount: '500.00', referenceNumber: 'REF-9', requestId: 'request', status: 'PENDING', createdAt: '2026-09-01T16:00:00.000Z' } })
    if (path === '/withdrawals/8') return jsonResponse(200, { body: { id: 8, amount: '300.00', destinationAccount: '****1234', destinationAccountHolder: 'Persona Titular', requestId: 'request', status: 'PENDING', createdAt: '2026-09-01T16:00:00.000Z' } })
    if (path === '/deposits') return onDepositList ? onDepositList(parsed, options) : jsonResponse(200, { body: { deposits: [], pagination: { totalItems: 0, currentPage: 1, totalPages: 0, limit: 10 } } })
    if (path === '/withdrawals') return jsonResponse(200, { body: { withdrawals: [], pagination: { totalItems: 0, currentPage: 1, totalPages: 0, limit: 10 } } })
    return jsonResponse(404, { body: { message: 'No encontrado' } })
  })
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.stubGlobal('crypto', { subtle: webcrypto.subtle, randomUUID: () => '11111111-1111-4111-8111-111111111111' })
})

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('depósitos y retiros idempotentes', () => {
  test('depósito exige confirmación y envía una sola solicitud con payload exacto', async () => {
    const fetchMock = financialFetch()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/depositos/nuevo')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Registrar un depósito' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('radio', { name: /Cuenta bancaria/i }))
    fireEvent.change(await screen.findByLabelText('Monto transferido'), { target: { value: '500.5' } })
    fireEvent.change(screen.getByLabelText('Número de referencia'), { target: { value: ' REF-9 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar depósito' }))
    expect(fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === '/deposits/create')).toHaveLength(0)
    expect(await screen.findByRole('heading', { name: 'Confirma el depósito' })).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Confirmar depósito' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(await screen.findByRole('heading', { name: 'Detalle de solicitud' })).toBeInTheDocument()
    const calls = fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === '/deposits/create')
    expect(calls).toHaveLength(1)
    expect(JSON.parse(calls[0][1].body)).toEqual({ amount: 500.5, referenceNumber: 'REF-9', destinationId: 21, requestId: '11111111-1111-4111-8111-111111111111' })
  })

  test('bloquea el formulario cuando todavía no existe un destino configurado', async () => {
    const fetchMock = financialFetch({ depositDestinations: [] })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/depositos/nuevo')
    render(<App />)

    expect(await screen.findByText('Depósitos temporalmente no disponibles')).toBeInTheDocument()
    expect(screen.getByText('Aún no existe una cuenta bancaria o SINPE Móvil configurado. Intenta nuevamente más tarde.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revisar depósito' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/deposits/create')).toBe(false)
  })

  test('retiro valida saldo, enmascara cuenta y no actualiza saldo optimistamente', async () => {
    let finishWithdrawal
    const pending = new Promise((resolve) => { finishWithdrawal = resolve })
    const fetchMock = financialFetch({ onWithdrawal: () => pending })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/retiros/nuevo')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Solicitar un retiro' })).toBeInTheDocument()
    expect(screen.getByText('Al confirmar, el monto queda retenido. Si el retiro es rechazado, el dinero será regresado a su billetera.')).toBeInTheDocument()
    fireEvent.change(await screen.findByLabelText('Monto a retirar'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('Cuenta destino o SINPE Móvil'), { target: { value: '123456781234' } })
    fireEvent.change(screen.getByLabelText('Nombre del titular de la cuenta destino o SINPE Móvil'), { target: { value: 'Persona Titular' } })
    expect(await screen.findByText(/₡700,00 disponibles/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar retiro' }))
    expect(await screen.findByText('********1234')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }))
    expect(screen.getByText(/Disponible: ₡1.000,00/)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/withdrawals/request')).toBe(true))
    const call = fetchMock.mock.calls.find(([url]) => new URL(url).pathname === '/withdrawals/request')
    expect(JSON.parse(call[1].body)).toEqual({ amount: 300, destinationAccount: '123456781234', destinationAccountHolder: 'Persona Titular', requestId: '11111111-1111-4111-8111-111111111111' })
    finishWithdrawal(jsonResponse(201, { body: { id: 8, status: 'PENDING' } }))
    expect(await screen.findByRole('heading', { name: 'Detalle de solicitud' })).toBeInTheDocument()
  })

  test('respuesta de red incierta se concilia y reintenta con el mismo requestId', async () => {
    let attempts = 0
    const requestIds = []
    const fetchMock = financialFetch({ onDeposit: (parsed, options) => {
      attempts += 1
      requestIds.push(JSON.parse(options.body).requestId)
      if (attempts === 1) throw new TypeError('network down')
      return jsonResponse(201, { body: { id: 9, status: 'PENDING' } })
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/depositos/nuevo')
    render(<App />)
    await screen.findByRole('heading', { name: 'Registrar un depósito' })
    fireEvent.click(await screen.findByRole('radio', { name: /Cuenta bancaria/i }))
    fireEvent.change(await screen.findByLabelText('Monto transferido'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Número de referencia'), { target: { value: 'REF-9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar depósito' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar depósito' }))
    expect(await screen.findByText('Hay un depósito sin confirmar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /comprobar estado/i }))
    expect(await screen.findByText(/todavía no encontró/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reintentar la misma solicitud/i }))
    expect(await screen.findByRole('heading', { name: 'Detalle de solicitud' })).toBeInTheDocument()
    expect(requestIds).toEqual(['11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'])
  })

  test('KYC requerido bloquea la mutación y dirige al perfil', async () => {
    const fetchMock = financialFetch({ kycStatus: 'PENDING' })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/retiros/nuevo')
    render(<App />)
    expect(await screen.findByText('Verifica tu identidad')).toBeInTheDocument()
    expect(screen.getByText('Tus datos personales deben ser verificados para solicitar retiros.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a verificación' })).toHaveAttribute('href', '/app/perfil')
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/withdrawals/request')).toBe(false)
  })

  test('explica con lenguaje claro por qué un depósito requiere verificación', async () => {
    vi.stubGlobal('fetch', financialFetch({ kycStatus: 'UNVERIFIED' }))
    window.history.replaceState({}, '', '/app/depositos/nuevo')
    render(<App />)

    expect(await screen.findByText('Tus datos personales deben ser verificados para solicitar depósitos.')).toBeInTheDocument()
  })

  test('recupera después de recargar usando solo el requestId persistido', async () => {
    const pending = await prepareIntent('deposit', { amount: '500.00', referenceNumber: 'REF-9', destinationId: 21 })
    const fetchMock = financialFetch({ onDepositList: (parsed) => {
      expect(parsed.searchParams.get('requestId')).toBe(pending.requestId)
      return jsonResponse(200, { body: { deposits: [{ id: 9, requestId: pending.requestId, amount: '500.00', referenceNumber: 'REF-9', status: 'PENDING' }], pagination: { totalItems: 1, currentPage: 1, totalPages: 1, limit: 10 } } })
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/depositos/nuevo')
    render(<App />)
    expect(await screen.findByText('Hay un depósito sin confirmar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /comprobar estado/i }))
    expect(await screen.findByRole('heading', { name: 'Detalle de solicitud' })).toBeInTheDocument()
    expect(sessionStorage.getItem('lottery:financial-intent:deposit')).toBeNull()
  })

  test('503 conserva la intención y no declara fracaso definitivo', async () => {
    const fetchMock = financialFetch({ onWithdrawal: () => jsonResponse(503, { code: 'SERVICE_BUSY', message: 'Servicio ocupado' }) })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/retiros/nuevo')
    render(<App />)
    await screen.findByRole('heading', { name: 'Solicitar un retiro' })
    fireEvent.change(await screen.findByLabelText('Monto a retirar'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('Cuenta destino o SINPE Móvil'), { target: { value: 'CUENTA-1' } })
    fireEvent.change(screen.getByLabelText('Nombre del titular de la cuenta destino o SINPE Móvil'), { target: { value: 'Persona Titular' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar retiro' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar retiro' }))
    expect(await screen.findByText('Hay un retiro sin confirmar')).toBeInTheDocument()
    expect(sessionStorage.getItem('lottery:financial-intent:withdrawal')).toContain('11111111-1111-4111-8111-111111111111')
  })

  test('referencia duplicada es definitiva y permite corregir el formulario', async () => {
    const fetchMock = financialFetch({ onDeposit: () => jsonResponse(409, { code: 'REFERENCE_ALREADY_USED', message: 'EL NÚMERO DE REFERENCIA YA FUE UTILIZADO' }) })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/depositos/nuevo')
    render(<App />)
    await screen.findByRole('heading', { name: 'Registrar un depósito' })
    fireEvent.click(await screen.findByRole('radio', { name: /Cuenta bancaria/i }))
    fireEvent.change(await screen.findByLabelText('Monto transferido'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Número de referencia'), { target: { value: 'REF-USADA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar depósito' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar depósito' }))
    expect(await screen.findByText(/referencia ya fue utilizado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar depósito' })).toBeEnabled()
  })

  test('saldo insuficiente se detiene antes de llamar a la API', async () => {
    const fetchMock = financialFetch()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/retiros/nuevo')
    render(<App />)
    await screen.findByRole('heading', { name: 'Solicitar un retiro' })
    fireEvent.change(await screen.findByLabelText('Monto a retirar'), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText('Cuenta destino o SINPE Móvil'), { target: { value: 'CUENTA-1' } })
    fireEvent.change(screen.getByLabelText('Nombre del titular de la cuenta destino o SINPE Móvil'), { target: { value: 'Persona Titular' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar retiro' }))
    expect(await screen.findByText('El monto supera tu saldo disponible actual.')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/withdrawals/request')).toBe(false))
  })
})
