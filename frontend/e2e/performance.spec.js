import { expect, test } from '@playwright/test'
import { installMockApi } from './fixtures/mock-api.js'

const WEB_VITAL_BUDGETS = { LCP: 2_500, INP: 200, CLS: 0.1 }

async function navigationMetrics(page) {
  await page.waitForTimeout(600)
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0]
    return {
      ttfb: Number((navigation.responseStart - navigation.startTime).toFixed(2)),
      domContentLoaded: Number((navigation.domContentLoadedEventEnd - navigation.startTime).toFixed(2)),
      load: Number((navigation.loadEventEnd - navigation.startTime).toFixed(2)),
      vitals: window.__Loto_WEB_VITALS__ || {},
    }
  })
}

function enforceBudgets(metrics, route) {
  expect(metrics.vitals.LCP?.value, `${route}: LCP no fue medido`).toBeDefined()
  expect(metrics.vitals.LCP.value, `${route}: LCP`).toBeLessThanOrEqual(WEB_VITAL_BUDGETS.LCP)
  expect(metrics.vitals.CLS?.value ?? 0, `${route}: CLS`).toBeLessThanOrEqual(WEB_VITAL_BUDGETS.CLS)
  if (metrics.vitals.INP) {
    expect(metrics.vitals.INP.value, `${route}: INP`).toBeLessThanOrEqual(WEB_VITAL_BUDGETS.INP)
  }
}

test('el build de producción cumple presupuestos en rutas web representativas', async ({ page }) => {
  await installMockApi(page, { playerAuthenticated: true, adminAuthenticated: true })
  const results = {}
  for (const route of ['/', '/login', '/app', '/app/jugar', '/admin']) {
    await page.goto(route, { waitUntil: 'networkidle' })
    await page.locator('body').click({ position: { x: 8, y: 8 } })
    const metrics = await navigationMetrics(page)
    enforceBudgets(metrics, route)
    results[route] = metrics
  }
  console.log(`[WEB PERFORMANCE] ${JSON.stringify(results)}`)
})

test('la portada sigue utilizable con red y CPU degradadas', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'La emulación usa Chrome DevTools Protocol.')
  await installMockApi(page)
  const session = await context.newCDPSession(page)
  await session.send('Network.enable')
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
    connectionType: 'cellular3g',
  })
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /Tu próxima jugada/i })).toBeVisible()
  const metrics = await navigationMetrics(page)
  expect(metrics.vitals.LCP?.value).toBeLessThanOrEqual(4_000)
  expect(metrics.vitals.CLS?.value ?? 0).toBeLessThanOrEqual(WEB_VITAL_BUDGETS.CLS)
  console.log(`[WEB PERFORMANCE DEGRADED] ${JSON.stringify(metrics)}`)
})
