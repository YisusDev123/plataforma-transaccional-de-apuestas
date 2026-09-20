import { webcrypto } from 'node:crypto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../App.jsx'

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const openBody = (salesEnabled = true) => ({
  sales_enabled: salesEnabled,
  currency: 'CRC',
  timezone: 'America/Costa_Rica',
  bet_rules: { min_bet_per_number: '10.00', max_ticket_total: '500.00' },
  draws: [{ draw_id: 1, lottery: 'NICA', modality: 'NORMAL', draw_date: '2026-09-02', schedule_time: '15:00:00', open_at: '2026-09-02T12:00:00Z', close_at: '2026-09-02T20:55:00Z', status: 'OPEN', payout_multiplier: '90.00', payout_rule_version: 1 }],
})

const numbers = Array.from({ length: 100 }, (_, index) => ({
  number: String(index).padStart(2, '0'),
  remaining_amount: '1000.00',
  available: true,
}))

const availabilityBody = {
  draw: { draw_id: 1, lottery: 'NICA', modality: 'NORMAL', draw_date: '2026-09-02', schedule_time: '15:00:00', open_at: '2026-09-02T12:00:00Z', close_at: '2026-09-02T20:55:00Z', status: 'OPEN', payout_multiplier: '90.00', payout_rule_version: 1 },
  sales_enabled: true,
  currency: 'CRC',
  timezone: 'America/Costa_Rica',
  bet_rules: { min_bet_per_number: '10.00', max_ticket_total: '500.00' },
  numbers,
}

const secondDraw = { draw_id: 2, lottery: 'TICA', modality: 'REVANCHA', draw_date: '2026-09-02', schedule_time: '18:00:00', open_at: '2026-09-02T15:00:00Z', close_at: '2026-09-02T23:55:00Z', status: 'OPEN', payout_multiplier: '200.00', payout_rule_version: 1 }

function betDetail() {
  return {
    id: 88, ticketCode: 'TICKET-88', requestId: '22222222-2222-4222-8222-222222222222', totalAmount: '25.00', status: 'CONFIRMED', createdAt: '2026-09-01T16:00:00.000Z',
    items: [{ id: 1, draw: { id: 1, lottery: 'NICA', modality: 'NORMAL', drawDate: '2026-09-02', scheduleTime: '15:00:00', status: 'OPEN', winningNumber: null }, numberPlayed: '05', amount: '25.00', multiplierSnapshot: '90', status: 'ACTIVE', payoutProcessed: false, potentialPayout: '2250.00', payoutAmount: '0.00' }],
  }
}

function bettingFetch({ balance = '1000.00', includeSecondDraw = false, kycStatus = 'APPROVED', onAvailability, onHistory, onPlace, salesEnabled = true } = {}) {
  return vi.fn(async (url, options = {}) => {
    const parsed = new URL(url)
    if (parsed.pathname === '/auth/refresh') return jsonResponse(200, { body: { accessToken: 'bet-access' } })
    if (parsed.pathname === '/auth/me') return jsonResponse(200, { body: { id: 7, email: 'jugador@example.com', emailVerified: true, status: 'ACTIVE', kycStatus } })
    if (parsed.pathname === '/draw/open') {
      const body = openBody(salesEnabled)
      if (includeSecondDraw) body.draws.push(secondDraw)
      return jsonResponse(200, { body })
    }
    if (parsed.pathname === '/draw/1/availability') return onAvailability ? onAvailability(parsed, options) : jsonResponse(200, { body: availabilityBody })
    if (parsed.pathname === '/draw/2/availability') return jsonResponse(200, { body: { ...availabilityBody, draw: secondDraw } })
    if (parsed.pathname === '/wallet/balance') return jsonResponse(200, { body: { id: 2, available_balance: balance, held_balance: '0.00' } })
    if (parsed.pathname === '/bet/place') return onPlace ? onPlace(parsed, options) : jsonResponse(200, { body: { ticket_code: 'TICKET-88', bet_id: 88, total_amount: '25.00', status: 'CONFIRMED' } })
    if (parsed.pathname === '/bet/history') return onHistory ? onHistory(parsed, options) : jsonResponse(200, { body: { tickets: [], pagination: { totalItems: 0, currentPage: 1, totalPages: 0, limit: 10 } } })
    if (parsed.pathname === '/bet/88') return jsonResponse(200, { body: betDetail() })
    return jsonResponse(404, { code: 'ROUTE_NOT_FOUND', message: 'No encontrado' })
  })
}

async function addPlay(amount = '25') {
  expect(await screen.findByRole('heading', { name: 'Crea tu jugada' })).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: /Número 05, disponible hasta/i }))
  fireEvent.change(screen.getByLabelText('Monto para número 05 de NICA'), { target: { value: amount } })
  expect(await screen.findByText('1 jugada')).toBeInTheDocument()
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.stubGlobal('crypto', { subtle: webcrypto.subtle, randomUUID: () => '22222222-2222-4222-8222-222222222222' })
  window.history.replaceState({}, '', '/app/jugar')
})

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('flujo de sorteos y apuestas', () => {
  test('permite seleccionar varios números y asignar un monto individual a cada uno', async () => {
    const fetchMock = bettingFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(await screen.findByText('Garantizamos un juego seguro y confiable.')).toBeInTheDocument()
    expect(await screen.findByText('Costa Rica')).toBeInTheDocument()
    expect(screen.queryByText(/tu identidad se comprobará/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/America\/Costa_Rica/i)).not.toBeInTheDocument()
    const number05 = await screen.findByRole('button', { name: /Número 05, disponible hasta/i }, { timeout: 3000 })
    const number55 = screen.getByRole('button', { name: /Número 55, disponible hasta/i })
    fireEvent.click(number05)
    fireEvent.click(number55)

    expect(number05).toHaveAttribute('aria-pressed', 'true')
    expect(number55).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('2 jugadas')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Monto para número 05 de NICA'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Monto para número 55 de NICA'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))
    expect(await screen.findByRole('heading', { name: 'Confirma tu apuesta' })).toBeInTheDocument()
    expect(screen.getByText('Una vez confirmada, la apuesta no puede editarse ni cancelarse.')).toBeInTheDocument()
    expect(screen.queryByText(/el backend volverá a comprobar/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y apostar' }))

    expect(await screen.findByRole('heading', { name: 'TICKET-88' })).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => new URL(url).pathname === '/bet/place')
    expect(JSON.parse(call[1].body)).toEqual({
      request_id: '22222222-2222-4222-8222-222222222222',
      bets: [
        { draw_id: 1, number_played: '05', amount: 25 },
        { draw_id: 1, number_played: '55', amount: 30 },
      ],
    })
  })

  test('tocar de nuevo un número seleccionado lo elimina del boleto', async () => {
    vi.stubGlobal('fetch', bettingFetch())
    render(<App />)

    const number05 = await screen.findByRole('button', { name: /Número 05, disponible hasta/i }, { timeout: 3000 })
    fireEvent.click(number05)
    expect(await screen.findByText('1 jugada')).toBeInTheDocument()
    fireEvent.click(number05)

    expect(await screen.findByText('0 jugadas')).toBeInTheDocument()
    expect(number05).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByLabelText('Monto para número 05 de NICA')).not.toBeInTheDocument()
  })

  test('impide mezclar otro sorteo o modalidad mientras el boleto tiene selecciones', async () => {
    vi.stubGlobal('fetch', bettingFetch({ includeSecondDraw: true }))
    render(<App />)

    const number05 = await screen.findByRole('button', { name: /Número 05, disponible hasta/i }, { timeout: 3000 })
    fireEvent.click(number05)
    fireEvent.click(screen.getByRole('button', { name: /TICA.*REVANCHA/i }))

    expect(await screen.findByText(/un solo sorteo y modalidad/i)).toBeInTheDocument()
    expect(number05).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Monto para número 05 de NICA')).toBeInTheDocument()
  })

  test('sin KYC permite explorar y preparar el boleto, pero no crea una apuesta', async () => {
    const fetchMock = bettingFetch({ kycStatus: 'PENDING' })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(await screen.findAllByRole('button', { name: /Número \d{2}, disponible hasta/i }, { timeout: 3000 })).toHaveLength(100)
    await addPlay()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))

    expect(await screen.findByText('Verifica tu identidad para apostar')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ir a verificación/i })).toHaveAttribute('href', '/app/perfil')
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/bet/place')).toBe(false)
    expect(sessionStorage.getItem('lottery:financial-intent:bet')).toBeNull()
  })

  test('conserva el borrador sólo en memoria al visitar verificación y regresar', async () => {
    const fetchMock = bettingFetch({ kycStatus: 'PENDING' })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await addPlay()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))
    fireEvent.click(await screen.findByRole('link', { name: /Ir a verificación/i }))
    expect(await screen.findByRole('heading', { name: 'Perfil y verificación' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('link', { name: 'Jugar' })[0])
    expect(await screen.findByRole('heading', { name: 'Crea tu jugada' })).toBeInTheDocument()
    expect(screen.getByText('1 jugada')).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.getItem('lottery:financial-intent:bet')).toBeNull()
  })

  test('confirma una sola vez, envía el payload canónico y actualiza por respuesta backend', async () => {
    const fetchMock = bettingFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await addPlay('25')

    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))
    expect(await screen.findByRole('heading', { name: 'Confirma tu apuesta' })).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Confirmar y apostar' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(await screen.findByRole('heading', { name: 'TICKET-88' })).toBeInTheDocument()
    const calls = fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === '/bet/place')
    expect(calls).toHaveLength(1)
    expect(JSON.parse(calls[0][1].body)).toEqual({
      request_id: '22222222-2222-4222-8222-222222222222',
      bets: [{ draw_id: 1, number_played: '05', amount: 25 }],
    })
    expect(sessionStorage.getItem('lottery:financial-intent:bet')).toBeNull()
  })

  test('saldo insuficiente se detecta sin enviar la mutación', async () => {
    const fetchMock = bettingFetch({ balance: '20.00' })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await addPlay('25')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))

    expect(await screen.findByText(/saldo disponible no alcanza/i)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/bet/place')).toBe(false)
  })

  test('ventas suspendidas mantienen visible y editable el boleto', async () => {
    const fetchMock = bettingFetch({ salesEnabled: false })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    expect(await screen.findByText('Ventas suspendidas')).toBeInTheDocument()
    await addPlay('25')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))
    expect(await screen.findByText(/venta de apuestas está temporalmente suspendida/i)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/bet/place')).toBe(false)
  })

  test('un sorteo que cierra antes de confirmar no genera una apuesta', async () => {
    let reads = 0
    const fetchMock = bettingFetch({
      onAvailability: () => {
        reads += 1
        if (reads === 1) return jsonResponse(200, { body: availabilityBody })
        return jsonResponse(404, { code: 'DRAW_UNAVAILABLE', message: 'El sorteo ya cerró' })
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await addPlay('25')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(2))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))

    expect(await screen.findByText(/sorteos? cerró o dejó de estar disponible/i)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/bet/place')).toBe(false)
  })

  test('si cambia el multiplicador exige revisar nuevamente antes de confirmar', async () => {
    let reads = 0
    const fetchMock = bettingFetch({
      onAvailability: () => {
        reads += 1
        const draw = reads === 1
          ? availabilityBody.draw
          : { ...availabilityBody.draw, payout_multiplier: '95.00', payout_rule_version: 2 }
        return jsonResponse(200, { body: { ...availabilityBody, draw } })
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await addPlay('25')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))

    expect(await screen.findByText(/multiplicador de premio cambió/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar y apostar' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/bet/place')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))
    expect(await screen.findByRole('button', { name: 'Confirmar y apostar' })).toBeInTheDocument()
    expect(screen.getAllByText(/×95\.00/).length).toBeGreaterThan(0)
  })

  test('una respuesta de red incierta se concilia y reintenta con el mismo request_id', async () => {
    let attempts = 0
    const fetchMock = bettingFetch({
      onPlace: () => {
        attempts += 1
        if (attempts === 1) throw new TypeError('network')
        return jsonResponse(200, { body: { ticket_code: 'TICKET-88', bet_id: 88, total_amount: '25.00', status: 'CONFIRMED' } })
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await addPlay('25')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y apostar' }))

    expect(await screen.findByRole('heading', { name: 'Hay un boleto sin confirmar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Comprobar estado/i }))
    expect(await screen.findByText(/todavía no encontró/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reintentar la misma solicitud/i }))
    expect(await screen.findByRole('heading', { name: 'TICKET-88' })).toBeInTheDocument()

    const requests = fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === '/bet/place').map(([, options]) => JSON.parse(options.body))
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual(requests[1])
  })

  test('un cambio concurrente de límite es definitivo, informa y libera la intención', async () => {
    const fetchMock = bettingFetch({ onPlace: () => jsonResponse(400, { code: 'NUMBER_LIMIT_EXCEEDED', message: 'Límite agotado' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await addPlay('25')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y apostar' }))

    expect(await screen.findByText(/disponibilidad de uno de los números cambió/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('lottery:financial-intent:bet')).toBeNull()
  })

  test('un conflicto idempotente conserva la intención y puede conciliar el ticket existente', async () => {
    const fetchMock = bettingFetch({
      onPlace: () => jsonResponse(409, { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', message: 'Identificador en uso' }),
      onHistory: () => jsonResponse(200, { body: { tickets: [{ id: 88, requestId: '22222222-2222-4222-8222-222222222222' }], pagination: { totalItems: 1, currentPage: 1, totalPages: 1, limit: 10 } } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await addPlay('25')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar apuesta' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y apostar' }))

    expect(await screen.findByRole('heading', { name: 'Hay un boleto sin confirmar' })).toBeInTheDocument()
    expect(sessionStorage.getItem('lottery:financial-intent:bet')).toContain('22222222-2222-4222-8222-222222222222')
    fireEvent.click(screen.getByRole('button', { name: /Comprobar estado/i }))
    expect(await screen.findByRole('heading', { name: 'TICKET-88' })).toBeInTheDocument()
    expect(sessionStorage.getItem('lottery:financial-intent:bet')).toBeNull()
  })
})
