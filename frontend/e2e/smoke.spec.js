import { expect, test } from '@playwright/test'
import { installMockApi } from './fixtures/mock-api.js'

test('portada, acceso y 404 funcionan en el motor del navegador', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Tu próxima jugada/ })).toBeVisible()
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  await page.goto('/ruta-no-existe')
  await expect(page.getByText('404')).toBeVisible()
})
