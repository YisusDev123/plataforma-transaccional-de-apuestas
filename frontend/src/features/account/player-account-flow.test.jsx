import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../App.jsx'

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const pagination = { totalItems: 1, currentPage: 1, totalPages: 1, limit: 10 }

function appFetch({ kycStatus = 'UNVERIFIED', overrides = {} } = {}) {
  let status = kycStatus
  return vi.fn(async (url, options = {}) => {
    const parsed = new URL(url)
    const path = parsed.pathname
    if (overrides[path]) return overrides[path](parsed, options)
    if (path === '/auth/refresh') return jsonResponse(200, { body: { accessToken: 'account-access' } })
    if (path === '/auth/me') return jsonResponse(200, { body: { id: 7, email: 'jugador@example.com', emailVerified: true, status: 'ACTIVE', kycStatus: status, fullName: status === 'UNVERIFIED' ? null : 'José Pérez', dni: status === 'UNVERIFIED' ? null : '123456789' } })
    if (path === '/auth/logout') return jsonResponse(200, { body: { message: 'SESIÓN CERRADA' } })
    if (path === '/wallet/balance') return jsonResponse(200, { body: { id: 2, available_balance: '1250.50', held_balance: '40.00', updated_at: '2026-09-01T16:00:00.000Z' } })
    if (path === '/wallet/transactions') return jsonResponse(200, { body: { transacciones: [{ id: 1, type: 'DEPOSIT', amount: '1250.50', balance_before: '0.00', balance_after: '1250.50', status: 'COMPLETED', created_at: '2026-09-01T16:00:00.000Z' }], pagination } })
    if (path === '/kyc/submit') {
      status = 'PENDING'
      return jsonResponse(201, { body: { message: 'KYC ENVIADO' } })
    }
    if (path === '/deposits') return jsonResponse(200, { body: { deposits: [{ id: 9, amount: '2500.00', referenceNumber: 'SIN-EXPONER', requestId: 'req-deposit-1', status: 'PENDING', rejectionReason: null, reviewedAt: null, createdAt: '2026-09-01T16:00:00.000Z' }], pagination: { ...pagination, totalPages: 2, totalItems: 11 } } })
    if (path === '/withdrawals') return jsonResponse(200, { body: { withdrawals: [], pagination: { totalItems: 0, currentPage: 1, totalPages: 0, limit: 10 } } })
    if (path === '/bet/history') return jsonResponse(200, { body: { tickets: [{ id: 4, ticketCode: 'ABC123', requestId: 'req-bet-1', totalAmount: '100.00', status: 'WON', itemCount: 1, totalPayout: '7000.00', totalRefunded: '0.00', createdAt: '2026-09-01T16:00:00.000Z' }], pagination } })
    if (path === '/bet/4') return jsonResponse(200, { body: { id: 4, ticketCode: 'ABC123', totalAmount: '100.00', status: 'WON', receiptAvailable: true, createdAt: '2026-09-01T16:00:00.000Z', items: [{ id: 40, draw: { id: 3, lottery: 'TICA', modality: 'NORMAL', drawDate: '2026-09-01T00:00:00.000Z', scheduleTime: '13:00:00', status: 'PAID', winningNumber: '25' }, numberPlayed: '25', amount: '100.00', multiplierSnapshot: '70.00', status: 'WON', payoutProcessed: true, potentialPayout: '7000.00', payoutAmount: '7000.00' }] } })
    if (path.startsWith('/deposits/')) return jsonResponse(404, { body: { message: 'DEPÓSITO NO ENCONTRADO' } })
    return jsonResponse(404, { body: { message: 'No encontrado' } })
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('cuenta y consultas financieras del jugador', () => {
  test('muestra dashboard con saldos decimales y movimientos reales', async () => {
    vi.stubGlobal('fetch', appFetch({ kycStatus: 'APPROVED' }))
    window.history.replaceState({}, '', '/app')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Tu cuenta, al día' })).toBeInTheDocument()
    expect(await screen.findByText('₡1.250,50')).toBeInTheDocument()
    expect(screen.getByText('₡40,00')).toBeInTheDocument()
    expect(screen.getByText('Identidad verificada')).toBeInTheDocument()
    expect(screen.getByText('Depósito')).toBeInTheDocument()
  })

  test.each(['UNVERIFIED', 'REJECTED'])('envía KYC desde %s, confirma el envío y actualiza el perfil a En revisión', async (initialStatus) => {
    const fetchMock = appFetch({ kycStatus: initialStatus })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/perfil')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Perfil y verificación' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: '  Jose\u0301 Pérez  ' } })
    fireEvent.change(screen.getByLabelText('Número de documento'), { target: { value: '123456789' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para revisión' }))
    expect(await screen.findByText('Datos enviados correctamente')).toBeInTheDocument()
    expect(screen.getByText('Recibimos tu información y la revisión está en proceso.')).toBeInTheDocument()
    expect(screen.getByText('Datos enviados correctamente').closest('[role="status"]')?.querySelector('.lucide-circle-check')).toBeInTheDocument()
    expect(screen.getByText('En revisión')).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => new URL(url).pathname === '/kyc/submit')
    expect(JSON.parse(call[1].body)).toEqual({ full_name: 'José Pérez', dni: '123456789' })
    expect(screen.queryByDisplayValue('123456789')).not.toBeInTheDocument()
  })

  test('muestra el nombre completo y la cédula del usuario en los datos de cuenta', async () => {
    vi.stubGlobal('fetch', appFetch({ kycStatus: 'APPROVED' }))
    window.history.replaceState({}, '', '/app/perfil')
    render(<App />)

    expect(await screen.findByText('José Pérez')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
    expect(screen.getByText('Nombre completo')).toBeInTheDocument()
    expect(screen.getByText('Cédula')).toBeInTheDocument()
  })

  test('indica cuando todavía no hay nombre ni cédula registrados', async () => {
    vi.stubGlobal('fetch', appFetch())
    window.history.replaceState({}, '', '/app/perfil')
    render(<App />)

    expect(await screen.findAllByText('Nombre completo')).toHaveLength(2)
    expect(screen.getByText('Cédula')).toBeInTheDocument()
    expect(screen.getAllByText('No disponible')).toHaveLength(2)
  })

  test.each([
    ['PENDING', 'Datos enviados correctamente'],
    ['APPROVED', 'Identidad verificada'],
    ['REJECTED', 'Envía nuevamente tus datos'],
  ])('representa el estado KYC %s', async (kycStatus, expected) => {
    vi.stubGlobal('fetch', appFetch({ kycStatus }))
    window.history.replaceState({}, '', '/app/perfil')
    render(<App />)
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  test('muestra la verificación pendiente como En revisión en el inicio', async () => {
    vi.stubGlobal('fetch', appFetch({ kycStatus: 'PENDING' }))
    window.history.replaceState({}, '', '/app')
    render(<App />)

    expect(await screen.findByText('Verificación en revisión')).toBeInTheDocument()
    expect(screen.getByText('En revisión')).toBeInTheDocument()
    expect(screen.queryByText('Completa tu verificación')).not.toBeInTheDocument()
  })

  test('conserva filtros y paginación de depósitos en la URL', async () => {
    const fetchMock = appFetch()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/depositos')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Depósitos' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'PENDING' } })
    fireEvent.change(screen.getByLabelText('Identificador de solicitud'), { target: { value: 'req-deposit-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(window.location.search).toContain('status=PENDING'))
    expect(window.location.search).toContain('requestId=req-deposit-1')
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(window.location.search).toContain('page=2'))
    const depositCalls = fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === '/deposits')
    expect(depositCalls.some(([url]) => new URL(url).searchParams.get('page') === '2')).toBe(true)
  })

  test('muestra una colección vacía coherente para retiros', async () => {
    vi.stubGlobal('fetch', appFetch())
    window.history.replaceState({}, '', '/app/retiros')
    render(<App />)
    expect(await screen.findByText('No encontramos retiros')).toBeInTheDocument()
  })

  test('un detalle ajeno o inexistente no expone información', async () => {
    vi.stubGlobal('fetch', appFetch())
    window.history.replaceState({}, '', '/app/depositos/999')
    render(<App />)
    expect(await screen.findByText('Depósito no encontrado')).toBeInTheDocument()
    expect(screen.getByText(/no existe o no pertenece a tu cuenta/i)).toBeInTheDocument()
  })

  test('muestra el ticket y sus valores históricos entregados por la API', async () => {
    vi.stubGlobal('fetch', appFetch())
    window.history.replaceState({}, '', '/app/tickets/4')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'ABC123' })).toBeInTheDocument()
    expect(screen.getByText('×70.00')).toBeInTheDocument()
    expect(screen.getAllByText('₡7.000,00')).toHaveLength(2)
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.queryByText('Request ID')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver comprobante' })).toHaveAttribute('href', '/app/tickets/4/comprobante')
  })

  test('busca el historial por el código visible del ticket y no por requestId', async () => {
    const fetchMock = appFetch()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/app/tickets')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Mis tickets' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Identificador de solicitud')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Código del ticket'), { target: { value: '6E6F55BA64DE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() => expect(window.location.search).toContain('ticketCode=6E6F55BA64DE'))
    const historyCalls = fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === '/bet/history')
    expect(historyCalls.some(([url]) => {
      const params = new URL(url).searchParams
      return params.get('ticketCode') === '6E6F55BA64DE' && !params.has('requestId')
    })).toBe(true)
  })

  test('presenta 503 como estado recuperable sin perder la sesión', async () => {
    vi.stubGlobal('fetch', appFetch({ overrides: { '/wallet/balance': () => jsonResponse(503, { body: { message: 'SERVICE_BUSY', code: 'SERVICE_BUSY' } }) } }))
    window.history.replaceState({}, '', '/app/billetera')
    render(<App />)
    expect(await screen.findByText('El servicio está ocupado', {}, { timeout: 3_000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByText('jugador@example.com')).toBeInTheDocument()
  })
})
