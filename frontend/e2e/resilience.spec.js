import { expect, test } from '@playwright/test'
import { installMockApi, mutationCount } from './fixtures/mock-api.js'

function apiError(status, code, message) {
  return {
    status,
    contentType: 'application/json',
    headers: { 'x-correlation-id': 'resilience-e2e' },
    body: JSON.stringify({ body: { code, message } }),
  }
}

test('un 503 de lectura ofrece recuperación sin expulsar al jugador', async ({ page }) => {
  const api = await installMockApi(page, {
    playerAuthenticated: true,
    overrides: { '/wallet/balance': apiError(503, 'SERVICE_BUSY', 'Servicio ocupado') },
  })
  await page.goto('/app')
  await expect(page.getByText('El servicio está ocupado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  expect(api.playerAuthenticated).toBe(true)
})

test('un 429 al apostar no duplica la mutación y conserva el boleto', async ({ page }) => {
  const api = await installMockApi(page, {
    playerAuthenticated: true,
    overrides: { '/bet/place': apiError(429, 'RATE_LIMITED', 'Demasiadas solicitudes') },
  })
  await page.goto('/app/jugar')
  await page.getByRole('button', { name: /Número 00,/ }).click()
  await page.getByLabel('Monto para número 00 de TICA').fill('100.00')
  await page.getByRole('button', { name: 'Revisar apuesta' }).click()
  await page.getByRole('button', { name: 'Confirmar y apostar' }).click()
  await expect(page.getByText(/demasiadas solicitudes/i)).toBeVisible()
  await expect(page.getByText('1 jugada')).toBeVisible()
  expect(mutationCount(api, '/bet/place')).toBe(1)
})
