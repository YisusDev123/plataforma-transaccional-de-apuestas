import { expect, test } from '@playwright/test'
import { installMockApi, mutationCount } from './fixtures/mock-api.js'

async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
    }
  })
}

test('manifest e instalación técnica contienen la identidad web requerida', async ({ page, request }) => {
  await page.goto('/')
  const manifestResponse = await request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBeTruthy()
  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({ name: 'Loto Demo', short_name: 'Loto', start_url: '/', scope: '/', display: 'standalone' })
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
    expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
  ]))
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')

  const workerSource = await (await request.get('/sw.js')).text()
  expect(workerSource).toContain('SKIP_WAITING')
  expect(workerSource).toContain('precacheAndRoute')
})

test('el service worker sólo conserva shell y assets del build, nunca rutas API', async ({ page }) => {
  await page.goto('/')
  await waitForServiceWorker(page)
  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys()
    const urls = []
    for (const name of names) {
      const requests = await (await caches.open(name)).keys()
      urls.push(...requests.map((entry) => entry.url))
    }
    return urls
  })

  expect(cachedUrls.length).toBeGreaterThan(10)
  const apiPath = /^\/(auth|admin|wallet|bet|deposits|withdrawals|draw|rules|numberLimit)(\/|$)/
  expect(cachedUrls.filter((entry) => apiPath.test(new URL(entry).pathname))).toEqual([])
  expect(cachedUrls.some((entry) => new URL(entry).pathname === '/index.html')).toBeTruthy()
})

test('el shell público abre desde el precache sin conexión', async ({ page, context }) => {
  await page.goto('/')
  await waitForServiceWorker(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Tu próxima jugada/ })).toBeVisible()
})

test('una pérdida de red no encola ni duplica apuestas', async ({ page, context }) => {
  const api = await installMockApi(page, { playerAuthenticated: true })
  await page.goto('/app/jugar')
  await expect(page.getByRole('heading', { name: 'Crea tu jugada' })).toBeVisible()
  await waitForServiceWorker(page)

  await context.setOffline(true)
  await expect(page.getByRole('heading', { name: 'Conexión necesaria' })).toBeVisible()
  await expect(page.getByText(/no mostramos saldos, sorteos ni operaciones/)).toBeVisible()
  await expect(page.getByText(/No se enviará ninguna operación automáticamente/)).toBeVisible()
  expect(mutationCount(api, '/bet/place')).toBe(0)

  const syncTags = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    if (!registration.sync?.getTags) return []
    try {
      return await registration.sync.getTags()
    } catch {
      return []
    }
  })
  expect(syncTags).toEqual([])

  const cachedApiUrls = await page.evaluate(async () => {
    const apiPath = /^\/(auth|admin|wallet|bet|deposits|withdrawals|draw|rules|numberLimit)(\/|$)/
    const names = await caches.keys()
    const urls = []
    for (const name of names) {
      const requests = await (await caches.open(name)).keys()
      urls.push(...requests.map((entry) => entry.url).filter((entry) => apiPath.test(new URL(entry).pathname)))
    }
    return urls
  })
  expect(cachedApiUrls).toEqual([])
})
