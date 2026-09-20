import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../App.jsx'
import { shouldRetryQuery } from '../../shared/api/query-options.js'
import { clearAllAccessTokens } from '../auth/session-store.js'

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function adminFetch({ role = 'EMPLOYEE', routes = {}, authenticated = true, playerAuthenticated = false } = {}) {
  return vi.fn(async (url, options = {}) => {
    const path = new URL(url).pathname
    if (routes[path]) return routes[path](options)
    if (path === '/auth/me') return playerAuthenticated ? response(200, { body: { id: 1, email: 'jugador@example.com', status: 'ACTIVE', kycStatus: 'APPROVED', emailVerified: true } }) : response(401, { code: 'UNAUTHORIZED' })
    if (path === '/auth/refresh') return response(401, { code: 'UNAUTHORIZED' })
    if (path === '/admin/me') return authenticated ? response(200, { body: { id: 9, email: 'admin@example.com', role, status: 'ACTIVE' } }) : response(401, { code: 'UNAUTHORIZED' })
    if (path === '/admin/refresh') return response(401, { code: 'UNAUTHORIZED' })
    if (path === '/admin/summary') return response(200, { body: { pending_kyc: 2, pending_deposits: 3, pending_withdrawals: 4, closed_draws: 1, system_status: { maintenance_mode: false, sales_enabled: true, message: '' } } })
    return response(404, { code: 'ROUTE_NOT_FOUND', message: 'No encontrado' })
  })
}

beforeEach(() => {
  clearAllAccessTokens()
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('sesión y autorización administrativa', () => {
  test('una sesión de jugador no autoriza el panel administrativo', async () => {
    vi.stubGlobal('fetch', adminFetch({ authenticated: false, playerAuthenticated: true }))
    window.history.replaceState({}, '', '/admin')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Panel administrativo' })).toBeInTheDocument()
  })

  test('login administrativo conserva el token sólo en memoria y abre el resumen', async () => {
    let loggedIn = false
    const fetchMock = adminFetch({ authenticated: false, routes: {
      '/admin/login': () => { loggedIn = true; return response(200, { body: { accessToken: 'admin-access', admin: { id: 9 } } }) },
      '/admin/me': () => loggedIn ? response(200, { body: { id: 9, email: 'admin@example.com', role: 'EMPLOYEE', status: 'ACTIVE' } }) : response(401, { code: 'UNAUTHORIZED' }),
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/login')
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Correo administrativo'), { target: { value: 'admin@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'segura123' } })
    fireEvent.click(screen.getByRole('button', { name: /Entrar al panel/i }))
    expect(await screen.findByRole('heading', { name: 'Resumen administrativo' })).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  test('EMPLOYEE ve operación diaria pero no reglas ni administradores', async () => {
    vi.stubGlobal('fetch', adminFetch())
    window.history.replaceState({}, '', '/admin')
    render(<App />)
    expect(await screen.findByText('KYC pendientes')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reglas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Multiplicadores' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Administradores' })).not.toBeInTheDocument()
  })

  test('EMPLOYEE no puede abrir directamente una pantalla SUPER_ADMIN', async () => {
    const fetchMock = adminFetch()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/reglas')
    render(<App />)
    expect(await screen.findByText('Acceso administrativo restringido')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/rules')).toBe(false)
  })

  test('EMPLOYEE no puede consultar destinos de depósito', async () => {
    const fetchMock = adminFetch()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/destinos-deposito')
    render(<App />)
    expect(await screen.findByText('Acceso administrativo restringido')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/admin/deposit-destination')).toBe(false)
  })

  test('una ruta administrativa inexistente autentica antes de mostrar su estado coherente', async () => {
    vi.stubGlobal('fetch', adminFetch())
    window.history.replaceState({}, '', '/admin/no-existe')
    render(<App />)
    expect(await screen.findByText('Ruta administrativa no encontrada')).toBeInTheDocument()
  })

  test('una ruta administrativa inexistente sin sesión redirige al login', async () => {
    vi.stubGlobal('fetch', adminFetch({ authenticated: false }))
    window.history.replaceState({}, '', '/admin/no-existe')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Panel administrativo' })).toBeInTheDocument()
  })
})

describe('operaciones administrativas', () => {
  test('no reintenta automáticamente una lectura limitada por 429', () => {
    expect(shouldRetryQuery(0, { status: 429 })).toBe(false)
    expect(shouldRetryQuery(0, { status: 503 })).toBe(true)
    expect(shouldRetryQuery(1, { status: 503 })).toBe(false)
  })

  test('SUPER_ADMIN configura una cuenta bancaria versionada', async () => {
    let payload
    const destinations = [{ id: 2, type: 'SINPE_MOVIL', destinationValue: '88888888', accountHolder: 'Comercio Demo', version: 1, createdAt: '2026-09-06T12:00:00Z' }]
    const fetchMock = adminFetch({ role: 'SUPER_ADMIN', routes: {
      '/admin/deposit-destination': (options) => {
        if (options.method === 'PUT') {
          payload = JSON.parse(options.body)
          destinations.push({ id: 3, ...payload, version: 1, createdAt: '2026-09-06T13:00:00Z' })
          return response(200, { body: { message: 'Actualizado', destination: destinations.at(-1) } })
        }
        return response(200, { body: { destinations } })
      },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/destinos-deposito')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Destinos de depósito' })).toBeInTheDocument()
    fireEvent.change(await screen.findByLabelText('IBAN de Costa Rica'), { target: { value: 'CR00 0000-0000-0000-0000-00' } })
    const holderFields = await screen.findAllByLabelText('Nombre del titular')
    fireEvent.change(holderFields[0], { target: { value: 'Comercio Demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar configuración' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar destino' }))

    await waitFor(() => expect(payload).toEqual({ type: 'BANK_ACCOUNT', destinationValue: 'CR00000000000000000000', accountHolder: 'Comercio Demo' }))
    expect(await screen.findByText('Cuenta bancaria actualizada correctamente.')).toBeInTheDocument()
  })

  test('lista apuestas entrantes y filtra por el código público del ticket', async () => {
    const fetchMock = adminFetch({ routes: {
      '/admin/bets': () => response(200, { body: { tickets: [{ id: 88, ticketCode: '6E6F55BA64DE', customerName: 'María Pérez', totalAmount: '2500.00', status: 'CONFIRMED', itemCount: 2, receiptAvailable: true, createdAt: '2026-09-05T15:00:00Z' }], pagination: { currentPage: 1, totalPages: 1 } } }),
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/apuestas')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Apuestas entrantes' })).toBeInTheDocument()
    expect(await screen.findByText('María Pérez')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver comprobante 6E6F55BA64DE' })).toHaveAttribute('href', '/admin/apuestas/88/comprobante')
    fireEvent.change(screen.getByLabelText('Código del ticket'), { target: { value: '6E6F55BA64DE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => new URL(url).searchParams.get('ticketCode') === '6E6F55BA64DE')).toBe(true))
  })

  test('un retiro muestra cuenta, titular indicado y titular KYC para revisión', async () => {
    const fetchMock = adminFetch({ routes: {
      '/admin/get-Withdrawals': () => response(200, { body: { withdrawals: [{ withdrawal_id: 12, user_id: 4, email: 'cliente@example.com', full_name: 'Persona KYC', request_id: 'retiro-12', amount: '500.00', withdrawal_account_snapshot: JSON.stringify({ cuenta: '88887777', titular: 'Persona Titular' }), status: 'PENDING', created_at: '2026-09-02T12:00:00Z' }], pagination: { currentPage: 1, totalPages: 1 } } }),
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/retiros')
    render(<App />)

    expect(await screen.findByText('Titular KYC: Persona KYC')).toBeInTheDocument()
    expect(screen.getByText('88887777')).toBeInTheDocument()
    expect(screen.getByText('Titular indicado: Persona Titular')).toBeInTheDocument()
  })

  test('aprueba un depósito una sola vez y reconsulta la cola', async () => {
    let approvals = 0
    let reads = 0
    const fetchMock = adminFetch({ routes: {
      '/admin/get-deposits': () => { reads += 1; return response(200, { body: { deposits: [{ id: 11, user_id: 4, email: 'cliente@example.com', full_name: 'Cliente Uno', reference_number: 'REF-11', amount: '500.00', status: reads === 1 ? 'PENDING' : 'APPROVED', created_at: '2026-09-02T12:00:00Z' }], pagination: { currentPage: 1, totalPages: 1 } } }) },
      '/admin/11/approve-deposits': () => { approvals += 1; return response(200, { body: { depositId: 11 } }) },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/depositos')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }))
    const confirm = screen.getByRole('button', { name: 'Confirmar aprobación' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await waitFor(() => expect(approvals).toBe(1))
    await waitFor(() => expect(reads).toBeGreaterThan(1))
    expect(await screen.findByText('Depósito aprobado correctamente.')).toBeInTheDocument()
  })

  test('un conflicto KYC concurrente informa y reconsulta sin inventar éxito', async () => {
    let reads = 0
    const fetchMock = adminFetch({ routes: {
      '/admin/kyc/request': () => { reads += 1; return response(200, { body: { solicitudes: [{ id: 8, user_id: 4, full_name: 'Persona Real', dni: '123456789', kyc_status: 'PENDING', created_at: '2026-09-02T12:00:00Z' }], pagination: { currentPage: 1, totalPages: 1 } } }) },
      '/admin/kyc/review': () => response(409, { code: 'STATE_CONFLICT', message: 'Ya procesado' }),
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/kyc')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }))
    fireEvent.change(screen.getByLabelText('Detalles para auditoría'), { target: { value: 'Documento inconsistente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar identidad' }))
    expect(await screen.findByText(/registro cambió mientras lo revisabas/i)).toBeInTheDocument()
    expect(reads).toBeGreaterThan(1)
  })

  test('EMPLOYEE carga un resultado 00–99 y no recibe acciones extraordinarias', async () => {
    let payload
    const fetchMock = adminFetch({ routes: {
      '/draw/admin': () => response(200, { body: { draws: [{ draw_id: 20, lottery: 'NICA', modality: 'NORMAL', draw_date: '2026-09-02', schedule_time: '15:00:00', status: 'CLOSED', result_number: null }], pagination: { currentPage: 1, totalPages: 1 } } }),
      '/draw/results': (options) => { payload = JSON.parse(options.body); return response(200, { body: { inserted_draws: 1 } }) },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/sorteos')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Resultado' }))
    fireEvent.change(screen.getByLabelText('Número ganador (00–99)'), { target: { value: '05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }))
    await waitFor(() => expect(payload).toEqual({ results: [{ draw_id: 20, winning_number: 5 }] }))
    expect(await screen.findByText('Resultado guardado correctamente.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Límites/i })).not.toBeInTheDocument()
  })

  test('SUPER_ADMIN consulta y modifica un límite con monto exacto', async () => {
    let payload
    const numbers = Array.from({ length: 100 }, (_, index) => ({ number: String(index).padStart(2, '0'), max_amount: '3000.00', current_amount: '0.00', remaining_amount: '3000.00' }))
    const fetchMock = adminFetch({ role: 'SUPER_ADMIN', routes: {
      '/draw/admin/20/limits': () => response(200, { body: { draw: { draw_id: 20, lottery: 'NICA', modality: 'NORMAL', status: 'OPEN' }, numbers } }),
      '/numberLimit/max-amount': (options) => { payload = JSON.parse(options.body); return response(200, { body: { draw_id: 20 } }) },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/sorteos/20/limites')
    render(<App />)
    const editButtons = await screen.findAllByRole('button', { name: 'Editar' })
    fireEvent.click(editButtons[5])
    fireEvent.change(screen.getByLabelText('Monto disponible desde ahora'), { target: { value: '4250.75' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar disponibilidad' }))
    await waitFor(() => expect(payload).toEqual({ draw_id: 20, number_played: 5, remaining_amount: 4250.75, expected_max_amount: 3000 }))
    expect(await screen.findByText('Disponibilidad actualizada correctamente.')).toBeInTheDocument()
  })

  test('suspender un usuario exige motivo y envía la identidad elegida por la interfaz', async () => {
    let payload
    const fetchMock = adminFetch({ routes: {
      '/admin/getUsers': () => response(200, { body: { users: [{ id: 31, email: 'usuario@example.com', status: 'ACTIVE', kyc_status: 'APPROVED', created_at: '2026-09-02T12:00:00Z' }], pagination: { currentPage: 1, totalPages: 1 } } }),
      '/admin/users/suspend': (options) => { payload = JSON.parse(options.body); return response(200, { body: { userId: 31, status: 'SUSPENDED' } }) },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/usuarios')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Suspender' }))
    const reasonField = screen.getByLabelText('Motivo obligatorio')
    expect(reasonField).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }))
    expect(await screen.findByText(/al menos 4 caracteres/i)).toBeInTheDocument()
    reasonField.focus()
    fireEvent.change(reasonField, { target: { value: 'A' } })
    expect(reasonField).toHaveFocus()
    fireEvent.change(reasonField, { target: { value: 'Actividad irregular revisada' } })
    expect(reasonField).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }))
    await waitFor(() => expect(payload).toEqual({ userId: 31, reason: 'Actividad irregular revisada' }))
    expect(await screen.findByText('Usuario suspendido correctamente.')).toBeInTheDocument()
  })

  test('SUPER_ADMIN modifica una sección de reglas sin acceder a otra sesión', async () => {
    let payload
    const settings = {
      system_status: { maintenance_mode: false, sales_enabled: true, message: '' },
      financial_rules: { min_bet_per_number: 10, max_ticket_total: 500 },
      draw_defaults: { default_risk_limit: 3000, auto_close_minutes_before: 10 },
      kyc_policies: { require_kyc_for_deposits: true, require_kyc_for_withdrawals: true },
      deposits_rules: { min_deposit: 100 },
      withdraws_rules: { min_withdrawal: 100 },
    }
    const fetchMock = adminFetch({ role: 'SUPER_ADMIN', routes: {
      '/rules': (options) => {
        if (!options.method) return response(200, { body: settings })
        return response(405, {})
      },
      '/rules/financial_rules': (options) => { payload = JSON.parse(options.body); return response(200, { body: { data: payload } }) },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/reglas')
    render(<App />)
    const input = await screen.findByLabelText('Mínimo por número')
    const section = input.closest('article')
    fireEvent.change(input, { target: { value: '25.50' } })
    fireEvent.click(within(section).getByRole('button', { name: 'Guardar sección' }))
    await waitFor(() => expect(payload).toEqual({ min_bet_per_number: 25.5, max_ticket_total: 500 }))
    expect(await within(section).findByText('Cambios guardados correctamente.')).toBeInTheDocument()
  })

  test('SUPER_ADMIN actualiza un multiplicador usando la versión consultada', async () => {
    let payload
    const rules = [{ id: 4, lottery: 'NICA', modality: 'NORMAL', multiplier: '85.00', isActive: true, version: 3, updatedAt: '2026-09-05T12:00:00Z' }]
    const fetchMock = adminFetch({ role: 'SUPER_ADMIN', routes: {
      '/admin/payout-rules': () => response(200, { body: { rules } }),
      '/admin/payout-rules/4': (options) => { payload = JSON.parse(options.body); return response(200, { body: { rule: { ...rules[0], multiplier: '90.25', version: 4 } } }) },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/multiplicadores')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Nuevo multiplicador'), { target: { value: '90.25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar multiplicador' }))
    await waitFor(() => expect(payload).toEqual({ multiplier: 90.25, expected_version: 3 }))
    expect(await screen.findByText('Multiplicador actualizado correctamente.')).toBeInTheDocument()
  })

  test('conserva las reglas y confirma el guardado si la recarga posterior recibe 429', async () => {
    let reads = 0
    let writes = 0
    const settings = {
      system_status: { maintenance_mode: false, sales_enabled: true, message: '' },
      financial_rules: { min_bet_per_number: 10, max_ticket_total: 500 },
      draw_defaults: { default_risk_limit: 3000, auto_close_minutes_before: 10 },
      kyc_policies: { require_kyc_for_deposits: true, require_kyc_for_withdrawals: true },
      deposits_rules: { min_deposit: 100 },
      withdraws_rules: { min_withdrawal: 100 },
    }
    const fetchMock = adminFetch({ role: 'SUPER_ADMIN', routes: {
      '/rules': () => {
        reads += 1
        return reads === 1
          ? response(200, { body: settings })
          : response(429, { body: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes.' } })
      },
      '/rules/draw_defaults': () => { writes += 1; return response(200, { body: { data: { default_risk_limit: 4250, auto_close_minutes_before: 10 } } }) },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/reglas')
    render(<App />)

    const input = await screen.findByLabelText('Disponibilidad por número desde ahora')
    const section = input.closest('article')
    fireEvent.change(input, { target: { value: '4250' } })
    fireEvent.click(within(section).getByRole('button', { name: 'Guardar sección' }))

    expect(await within(section).findByText('Cambios guardados correctamente.')).toBeInTheDocument()
    expect(screen.getByLabelText('Disponibilidad por número desde ahora')).toHaveValue('4250')
    expect(await screen.findByText(/El servicio está ocupado/i)).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Guardar sección' })).toBeInTheDocument()
    expect(writes).toBe(1)
    expect(reads).toBe(2)
  })

  test('SUPER_ADMIN sólo puede crear una cuenta EMPLOYEE', async () => {
    let payload
    const fetchMock = adminFetch({ role: 'SUPER_ADMIN', routes: {
      '/admin/getAdmins': () => response(200, { body: { admins: [{ id: 1, email: 'root@example.com', role: 'SUPER_ADMIN', status: 'ACTIVE', created_at: '2026-09-02T12:00:00Z' }] } }),
      '/admin/create': (options) => { payload = JSON.parse(options.body); return response(201, { body: { nuevoAdminId: 10 } }) },
    } })
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/admin/administradores')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Crear empleado' }))
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'empleado@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña temporal'), { target: { value: 'segura123' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear empleado' }))
    await waitFor(() => expect(payload).toEqual({ email: 'empleado@example.com', password: 'segura123', role: 'EMPLOYEE' }))
    expect(await screen.findByText('Empleado creado correctamente.')).toBeInTheDocument()
  })
})
