import { expect, test } from '@playwright/test'
import { installMockApi } from './fixtures/mock-api.js'

for (const scenario of [
  { path: '/', name: 'portada', heading: /Tu próxima jugada/, options: {} },
  { path: '/login', name: 'login', heading: 'Inicia sesión', options: {} },
  { path: '/app', name: 'jugador', heading: 'Tu cuenta, al día', options: { playerAuthenticated: true } },
  { path: '/app/jugar', name: 'apuestas', heading: 'Crea tu jugada', options: { playerAuthenticated: true } },
  { path: '/app/retiros/nuevo', name: 'retiro-nuevo', heading: 'Solicitar un retiro', options: { playerAuthenticated: true } },
  { path: '/admin', name: 'administracion', heading: 'Resumen administrativo', options: { adminAuthenticated: true, role: 'SUPER_ADMIN' } },
  { path: '/admin/depositos', name: 'depositos-admin', heading: 'Depósitos', options: { adminAuthenticated: true } },
]) {
  test(`baseline visual: ${scenario.name}`, async ({ page }) => {
    await installMockApi(page, scenario.options)
    await page.goto(scenario.path)
    await expect(page.getByRole('heading', { name: scenario.heading })).toBeVisible()
    await expect(page).toHaveScreenshot(`${scenario.name}.png`, { fullPage: true })
  })
}
