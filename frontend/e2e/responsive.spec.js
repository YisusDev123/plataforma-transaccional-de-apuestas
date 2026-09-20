import { expect, test } from '@playwright/test'
import { installMockApi } from './fixtures/mock-api.js'

for (const scenario of [
  { path: '/', options: {}, navigation: 'Navegación pública móvil', heading: /Tu próxima jugada/ },
  { path: '/app', options: { playerAuthenticated: true }, navigation: 'Navegación de jugador móvil', heading: 'Tu cuenta, al día' },
  { path: '/app/jugar', options: { playerAuthenticated: true }, navigation: 'Navegación de jugador móvil', heading: 'Crea tu jugada' },
  { path: '/admin', options: { adminAuthenticated: true }, navigation: 'Navegación administrativa móvil', heading: 'Resumen administrativo' },
]) {
  test(`${scenario.path} funciona sin overflow horizontal en móvil`, async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await installMockApi(page, scenario.options)
    await page.goto(scenario.path)
    await expect(page.getByRole('heading', { name: scenario.heading })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    if (scenario.path === '/app/jugar') {
      const firstNumber = await page.getByRole('button', { name: /Número 00,/ }).boundingBox()
      const lastNumber = await page.getByRole('button', { name: /Número 99,/ }).boundingBox()
      expect(lastNumber.y).toBeGreaterThan(firstNumber.y)
    }
    if (scenario.path !== '/') await expect(page.getByRole('navigation', { name: scenario.navigation })).toBeVisible()
  })
}

test('la portada sigue operable a 320px y el menú gestiona su estado accesible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await installMockApi(page)
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Abrir menú' })
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await menu.click()
  await expect(page.getByRole('navigation', { name: 'Navegación pública móvil' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
