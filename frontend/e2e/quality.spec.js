import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { installMockApi } from './fixtures/mock-api.js'

for (const scenario of [
  { path: '/', name: 'portada', heading: /Tu próxima jugada/, options: {} },
  { path: '/login', name: 'login', heading: 'Inicia sesión', options: {} },
  { path: '/app', name: 'dashboard de jugador', heading: 'Tu cuenta, al día', options: { playerAuthenticated: true } },
  { path: '/admin', name: 'dashboard administrativo', heading: 'Resumen administrativo', options: { adminAuthenticated: true, role: 'SUPER_ADMIN' } },
]) {
  test(`${scenario.name} no tiene violaciones axe críticas o serias`, async ({ page }) => {
    await installMockApi(page, scenario.options)
    await page.goto(scenario.path)
    await expect(page.getByRole('heading', { name: scenario.heading })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact))).toEqual([])
  })
}

test('el frontend no produce errores JS ni requests fallidos durante navegación pública', async ({ page }) => {
  await installMockApi(page)
  const errors = []
  const failedRequests = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text())
  })
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`))
  await page.goto('/')
  await page.getByRole('link', { name: 'Crear cuenta' }).first().click()
  await expect(page.getByRole('heading', { name: 'Crea tu acceso' })).toBeVisible()
  expect(errors).toEqual([])
  expect(failedRequests).toEqual([])
})
