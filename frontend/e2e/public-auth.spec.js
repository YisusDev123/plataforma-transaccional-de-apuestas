import { expect, test } from '@playwright/test'
import { expectNoPersistentTokens, installMockApi, mutationCount } from './fixtures/mock-api.js'

test('login conserva sesiones en memoria, evita returnTo externo y envía una sola mutación', async ({ page }) => {
  const api = await installMockApi(page)
  await page.goto('/login?returnTo=https://evil.example/robo')
  await page.getByLabel('Correo electrónico').fill('jugador@example.test')
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('ClaveSegura123!')
  await page.getByRole('button', { name: /^Entrar/ }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { name: 'Tu cuenta, al día' })).toBeVisible()
  expect(mutationCount(api, '/auth/login')).toBe(1)
  await expectNoPersistentTokens(page)
})

test('formularios de acceso validan antes de tocar la API', async ({ page }) => {
  const api = await installMockApi(page)
  await page.goto('/login')
  await page.getByRole('button', { name: /^Entrar/ }).click()
  await expect(page.getByText('Ingresa tu correo electrónico.')).toBeVisible()
  expect(mutationCount(api, '/auth/login')).toBe(0)
})

test('una ruta inexistente responde con una pantalla coherente', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/ninguna')
  await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir al inicio' }).last()).toBeVisible()
})
