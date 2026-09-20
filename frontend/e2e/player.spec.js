import { expect, test } from '@playwright/test'
import { installMockApi, mutationCount } from './fixtures/mock-api.js'

async function prepareBet(page) {
  await page.goto('/app/jugar')
  await expect(page.getByRole('heading', { name: 'Crea tu jugada' })).toBeVisible()
  await page.getByRole('button', { name: /Número 00,/ }).click()
  await page.getByLabel('Monto para número 00 de TICA').fill('100.00')
  await page.getByRole('button', { name: 'Revisar apuesta' }).click()
}

test('permite preparar varios números con montos independientes', async ({ page }) => {
  const api = await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app/jugar')
  await page.getByRole('button', { name: /Número 00,/ }).click()
  await page.getByRole('button', { name: /Número 55,/ }).click()
  await page.getByLabel('Monto para número 00 de TICA').fill('100.00')
  await page.getByLabel('Monto para número 55 de TICA').fill('150.00')
  await expect(page.getByText('2 jugadas')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar apuesta' }).click()
  await expect(page.getByRole('dialog', { name: 'Confirma tu apuesta' })).toContainText('2')
  await page.getByRole('button', { name: 'Confirmar y apostar' }).click()
  await expect(page).toHaveURL(/\/app\/tickets\/501$/)
  expect(mutationCount(api, '/bet/place')).toBe(1)
  expect(api.requests.find((request) => request.path === '/bet/place').body.bets).toEqual([
    { draw_id: 41, number_played: '00', amount: 100 },
    { draw_id: 41, number_played: '55', amount: 150 },
  ])
})

test('organiza números y boleto en flujo vertical sin invadir el selector', async ({ page }) => {
  await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app/jugar')

  const numbersPanel = await page.locator('section[aria-labelledby="numbers-title"]').boundingBox()
  const ticketPanel = await page.locator('aside[aria-labelledby="ticket-title"]').boundingBox()
  const firstNumber = await page.getByRole('button', { name: /Número 00,/ }).boundingBox()
  const lastNumber = await page.getByRole('button', { name: /Número 99,/ }).boundingBox()

  expect(lastNumber.y).toBeGreaterThan(firstNumber.y)
  expect(ticketPanel.y).toBeGreaterThanOrEqual(numbersPanel.y + numbersPanel.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

test('el jugador sin KYC puede explorar y preparar, pero no enviar', async ({ page }) => {
  const api = await installMockApi(page, { playerAuthenticated: true, kycStatus: 'NO_KYC' })
  await prepareBet(page)
  await expect(page.getByText('Verifica tu identidad para apostar')).toBeVisible()
  expect(mutationCount(api, '/bet/place')).toBe(0)
  await expect(page.getByText('1 jugada')).toBeVisible()
})

test('una apuesta confirmada genera exactamente una solicitud y espera respuesta backend', async ({ page }) => {
  const api = await installMockApi(page, { playerAuthenticated: true })
  await prepareBet(page)
  await expect(page.getByRole('dialog', { name: 'Confirma tu apuesta' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar y apostar' }).click()
  await expect(page).toHaveURL(/\/app\/tickets\/501$/)
  expect(mutationCount(api, '/bet/place')).toBe(1)
  await expect(page.getByText(/₡100[.,]00/).first()).toBeVisible()
})

test('el jugador abre y descarga el comprobante privado de su apuesta', async ({ page }) => {
  const api = await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app/tickets/501')
  await page.getByRole('link', { name: 'Ver comprobante' }).click()
  await expect(page).toHaveURL(/\/app\/tickets\/501\/comprobante$/)
  await expect(page.getByTitle('Comprobante PDF de la apuesta')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Descargar' })).toHaveAttribute('download', 'comprobante-TICKET-501.pdf')
  await expect.poll(() => api.requests.filter((entry) => entry.path === '/bet/501/receipt').length).toBe(1)
})

test('el dashboard muestra dinero recibido como strings sin actualización simulada', async ({ page }) => {
  await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app')
  await expect(page.getByText(/₡25[.,]000[.,]50/)).toBeVisible()
  await expect(page.getByText(/₡1[.,]250[.,]00/)).toBeVisible()
})

test('el jugador selecciona el destino publicado y lo conserva al registrar el depósito', async ({ page }) => {
  const api = await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app/depositos/nuevo')

  await expect(page.getByText('CR00000000000000000000')).toBeVisible()
  await expect(page.getByText('88888888')).toBeVisible()
  await page.getByRole('radio', { name: /SINPE Móvil/i }).check()
  await page.getByLabel('Monto transferido').fill('1500.00')
  await page.getByLabel('Número de referencia').fill('REF-9')
  await page.getByRole('button', { name: 'Revisar depósito' }).click()
  await expect(page.getByRole('dialog', { name: 'Confirma el depósito' })).toContainText('88888888')
  await page.getByRole('button', { name: 'Confirmar depósito' }).click()

  await expect(page).toHaveURL(/\/app\/depositos\/9$/)
  expect(api.requests.find((request) => request.path === '/deposits/create').body).toMatchObject({
    amount: 1500,
    referenceNumber: 'REF-9',
    destinationId: 22,
  })
})

test('el perfil muestra nombre completo y cédula del jugador autenticado', async ({ page }) => {
  await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app/perfil')

  await expect(page.getByRole('heading', { name: 'Perfil y verificación' })).toBeVisible()
  await expect(page.getByText('Jugador Prueba')).toBeVisible()
  await expect(page.getByText('123456789')).toBeVisible()
  await expect(page.getByText('Cédula')).toBeVisible()
})

test('el envío de KYC confirma visualmente que los datos fueron recibidos', async ({ page }) => {
  const api = await installMockApi(page, { playerAuthenticated: true, kycStatus: 'NO_KYC' })
  await page.goto('/app/perfil')
  await page.getByLabel('Nombre completo').fill('Jugador Prueba')
  await page.getByLabel('Número de documento').fill('123456789')
  await page.getByRole('button', { name: 'Enviar para revisión' }).click()

  const confirmation = page.getByRole('status').filter({ hasText: 'Datos enviados correctamente' })
  await expect(confirmation).toBeVisible()
  await expect(confirmation).toContainText('Recibimos tu información y la revisión está en proceso.')
  await expect(page.getByText('En revisión', { exact: true })).toBeVisible()
  expect(mutationCount(api, '/kyc/submit')).toBe(1)
})

test('Mis tickets busca mediante el código visible para el jugador', async ({ page }) => {
  await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app/tickets')
  await expect(page.getByRole('heading', { name: 'Mis tickets' })).toBeVisible()
  await expect(page.getByLabel('Identificador de solicitud')).toHaveCount(0)
  await page.getByLabel('Código del ticket').fill('6E6F55BA64DE')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(page).toHaveURL(/ticketCode=6E6F55BA64DE/)
})
