import { expect, test } from '@playwright/test'
import { installMockApi } from './fixtures/mock-api.js'

async function expectBusinessTimezone(page) {
  await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app/jugar')
  await expect(page.getByRole('heading', { name: 'Crea tu jugada' })).toBeVisible()
  await expect(page.getByRole('button', { name: /TICA NORMAL 3 sept 2026/ })).toContainText('19:30:00')
  await expect(page.getByRole('button', { name: /TICA NORMAL 3 sept 2026/ })).toContainText(/Cierra 3 sept 2026, 7:25 p\. m\./)
}

test.describe('dispositivo en UTC', () => {
  test.use({ timezoneId: 'UTC' })
  test('conserva fecha calendario y presenta instantes en Costa Rica', async ({ page }) => expectBusinessTimezone(page))
})

test.describe('dispositivo en Asia/Tokyo', () => {
  test.use({ timezoneId: 'Asia/Tokyo' })
  test('no desplaza la fecha ni usa la hora del dispositivo', async ({ page }) => expectBusinessTimezone(page))
})
