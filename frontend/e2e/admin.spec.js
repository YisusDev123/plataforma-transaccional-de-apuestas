import { expect, test } from '@playwright/test'
import { installMockApi, mutationCount } from './fixtures/mock-api.js'

test('SUPER_ADMIN configura ambos destinos y EMPLOYEE no accede a la pantalla', async ({ page }) => {
  const api = await installMockApi(page, { adminAuthenticated: true, role: 'SUPER_ADMIN' })
  await page.goto('/admin/destinos-deposito')
  await expect(page.getByRole('heading', { name: 'Destinos de depósito' })).toBeVisible()
  await page.getByLabel('Número de teléfono').fill('8777-7777')
  await page.getByRole('button', { name: 'Revisar actualización' }).last().click()
  await page.getByRole('button', { name: 'Guardar destino' }).click()
  await expect(page.getByText('SINPE Móvil actualizada correctamente.')).toBeVisible()
  expect(api.requests.find((request) => request.path === '/admin/deposit-destination' && request.method === 'PUT').body).toEqual({
    type: 'SINPE_MOVIL', destinationValue: '87777777', accountHolder: 'Comercio Demo',
  })

  await page.reload()
  api.role = 'EMPLOYEE'
  await page.goto('/admin/destinos-deposito')
  await expect(page.getByText('Acceso administrativo restringido')).toBeVisible()
})

test('EMPLOYEE ve operación diaria pero no controles SUPER_ADMIN', async ({ page }) => {
  await installMockApi(page, { adminAuthenticated: true, role: 'EMPLOYEE' })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Resumen administrativo' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Reglas' })).toHaveCount(0)
  await page.goto('/admin/reglas')
  await expect(page.getByRole('heading', { name: 'Acceso administrativo restringido' })).toBeVisible()
})

test('SUPER_ADMIN recibe navegación ampliada', async ({ page }) => {
  await installMockApi(page, { adminAuthenticated: true, role: 'SUPER_ADMIN' })
  await page.goto('/admin')
  await expect(page.getByRole('link', { name: 'Reglas' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Multiplicadores' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Administradores' }).first()).toBeVisible()
})

test('EMPLOYEE filtra apuestas entrantes y visualiza su comprobante', async ({ page }) => {
  const api = await installMockApi(page, { adminAuthenticated: true, role: 'EMPLOYEE' })
  await page.goto('/admin/apuestas')
  await expect(page.getByRole('heading', { name: 'Apuestas entrantes' })).toBeVisible()
  await expect(page.getByText('Jugador Prueba')).toBeVisible()
  await page.getByLabel('Código del ticket').fill('TICKET-501')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(page).toHaveURL(/ticketCode=TICKET-501/)
  await page.getByRole('link', { name: 'Ver comprobante TICKET-501' }).click()
  await expect(page.getByTitle('Comprobante PDF administrativo de la apuesta')).toBeVisible()
  await expect.poll(() => api.requests.filter((entry) => entry.path === '/admin/bets/501/receipt').length).toBe(1)
})

test('SUPER_ADMIN aumenta la disponibilidad de un número agotado', async ({ page }) => {
  const api = await installMockApi(page, { adminAuthenticated: true, role: 'SUPER_ADMIN' })
  await page.goto('/admin/sorteos/41/limites')
  await page.getByLabel('Disponibilidad').selectOption('EXHAUSTED')
  await expect(page.getByText('Agotado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Monto disponible desde ahora').fill('1000.00')
  await expect(page.getByText(/Nueva disponibilidad:/)).toContainText('₡1.000,00')
  await page.getByRole('button', { name: 'Guardar disponibilidad' }).click()
  await expect.poll(() => mutationCount(api, '/numberLimit/max-amount')).toBe(1)
  const request = api.requests.find((entry) => entry.path === '/numberLimit/max-amount' && entry.method === 'PUT')
  expect(request.body).toEqual({ draw_id: 41, number_played: 0, remaining_amount: 1000, expected_max_amount: 5000 })
})

test('SUPER_ADMIN edita un multiplicador con control de versión', async ({ page }) => {
  const api = await installMockApi(page, { adminAuthenticated: true, role: 'SUPER_ADMIN' })
  await page.goto('/admin/multiplicadores')
  await expect(page.getByText('×85.00')).toBeVisible()
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Nuevo multiplicador').fill('90.25')
  await page.getByRole('button', { name: 'Guardar multiplicador' }).click()
  await expect.poll(() => mutationCount(api, '/admin/payout-rules/4')).toBe(1)
  const request = api.requests.find((entry) => entry.path === '/admin/payout-rules/4' && entry.method === 'PATCH')
  expect(request.body).toEqual({ multiplier: 90.25, expected_version: 3 })
})

test('aprobar un depósito exige confirmación y produce una sola mutación', async ({ page }) => {
  const api = await installMockApi(page, { adminAuthenticated: true })
  await page.goto('/admin/depositos')
  await expect(page.getByText(/₡1[.,]500[.,]00/)).toBeVisible()
  await page.getByRole('button', { name: 'Aprobar' }).click()
  expect(mutationCount(api, '/admin/9/approve-deposits')).toBe(0)
  await page.getByRole('button', { name: 'Confirmar aprobación' }).click()
  await expect.poll(() => mutationCount(api, '/admin/9/approve-deposits')).toBe(1)
  await expect(page.getByText('Depósito aprobado correctamente.')).toBeVisible()
})

test('el motivo de suspensión conserva el foco mientras se escribe', async ({ page }) => {
  await installMockApi(page, {
    adminAuthenticated: true,
    overrides: {
      '/admin/getUsers': {
        users: [{
          id: 31,
          email: 'usuario@example.test',
          status: 'ACTIVE',
          kyc_status: 'APPROVED',
          created_at: '2026-09-02T12:00:00Z',
        }],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 1, limit: 20 },
      },
    },
  })
  await page.goto('/admin/usuarios')
  await page.getByRole('button', { name: 'Suspender' }).click()

  const reasonField = page.getByLabel('Motivo obligatorio')
  await expect(reasonField).toBeFocused()
  await reasonField.pressSequentially('Actividad irregular revisada')
  await expect(reasonField).toHaveValue('Actividad irregular revisada')
  await expect(reasonField).toBeFocused()
})

test('una recarga limitada no oculta un cambio de reglas confirmado', async ({ page }) => {
  let ruleReads = 0
  const settings = {
    system_status: { maintenance_mode: false, sales_enabled: true, message: '' },
    financial_rules: { min_bet_per_number: 10, max_ticket_total: 500 },
    draw_defaults: { default_risk_limit: 3000, auto_close_minutes_before: 10 },
    kyc_policies: { require_kyc_for_deposits: true, require_kyc_for_withdrawals: true },
    deposits_rules: { min_deposit: 100 },
    withdraws_rules: { min_withdrawal: 100 },
  }
  const api = await installMockApi(page, {
    adminAuthenticated: true,
    role: 'SUPER_ADMIN',
    overrides: {
      'GET /rules': () => {
        ruleReads += 1
        if (ruleReads === 1) return settings
        return {
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ body: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes.' } }),
        }
      },
      'PATCH /rules/draw_defaults': { data: { default_risk_limit: 4250, auto_close_minutes_before: 10 } },
    },
  })
  await page.goto('/admin/reglas')

  const section = page.locator('article').filter({ hasText: 'Valores de sorteos automáticos' })
  await section.getByLabel('Disponibilidad por número desde ahora').fill('4250')
  await section.getByRole('button', { name: 'Guardar sección' }).click()

  await expect(section.getByText('Cambios guardados correctamente.')).toBeVisible()
  await expect(section.getByLabel('Disponibilidad por número desde ahora')).toHaveValue('4250')
  await expect(page.getByText(/El servicio está ocupado/i)).toBeVisible()
  await expect(section.getByRole('button', { name: 'Guardar sección' })).toBeVisible()
  await expect.poll(() => mutationCount(api, '/rules/draw_defaults')).toBe(1)
  expect(ruleReads).toBe(2)
})
