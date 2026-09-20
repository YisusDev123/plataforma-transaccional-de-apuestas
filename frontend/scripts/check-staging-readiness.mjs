import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

function requiredUrl(name, value, environment = process.env) {
  if (!value) throw new Error(`${name} es obligatorio.`)
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash) throw new Error(`${name} no debe contener credenciales, query ni fragmento.`)
  const localTest = environment.NODE_ENV === 'test' && environment.WEB_STAGING_ALLOW_HTTP === 'true'
  if (url.protocol !== 'https:' && !localTest) throw new Error(`${name} debe usar HTTPS.`)
  return url
}

async function expectResponse(fetchImpl, url, label, validate) {
  const response = await fetchImpl(url, { redirect: 'manual' })
  if (!response.ok) throw new Error(`${label} respondió HTTP ${response.status}.`)
  if (validate) await validate(response)
  return response
}

export async function checkStagingReadiness(environment = process.env, fetchImpl = fetch) {
  const webUrl = requiredUrl('WEB_STAGING_URL', environment.WEB_STAGING_URL, environment)
  const apiUrl = requiredUrl('WEB_STAGING_API_URL', environment.WEB_STAGING_API_URL, environment)
  const checked = []

  await expectResponse(fetchImpl, new URL('/', webUrl), 'Frontend', async response => {
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Frontend no respondió HTML.')
  })
  checked.push('frontend_html')

  const manifest = await expectResponse(fetchImpl, new URL('/manifest.webmanifest', webUrl), 'Manifest')
  const manifestBody = await manifest.json()
  if (!manifestBody.name || !Array.isArray(manifestBody.icons) || manifestBody.icons.length < 2) {
    throw new Error('El manifest no contiene nombre e iconos suficientes.')
  }
  checked.push('manifest')

  await expectResponse(fetchImpl, new URL('/sw.js', webUrl), 'Service worker', response => {
    const cacheControl = response.headers.get('cache-control') || ''
    if (!/(no-cache|no-store|max-age=0)/i.test(cacheControl)) {
      throw new Error('sw.js debe desplegarse con revalidación o sin caché persistente.')
    }
  })
  checked.push('service_worker_headers')

  await expectResponse(fetchImpl, new URL(`/certificacion-${Date.now()}`, webUrl), 'Fallback SPA', async response => {
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('El fallback SPA no respondió HTML.')
  })
  checked.push('spa_fallback')

  await expectResponse(fetchImpl, new URL('/health/ready', apiUrl), 'Readiness API')
  checked.push('api_readiness')

  const corsResponse = await fetchImpl(new URL('/rules', apiUrl), { headers: { Origin: webUrl.origin } })
  if (corsResponse.headers.get('access-control-allow-origin') !== webUrl.origin) {
    throw new Error('CORS no autoriza exactamente el origen web de staging.')
  }
  checked.push('cors_exact_origin')

  if (webUrl.protocol === 'https:') {
    const webResponse = await fetchImpl(new URL('/', webUrl))
    if (!webResponse.headers.get('strict-transport-security')) throw new Error('Falta HSTS en el frontend de staging.')
    checked.push('hsts')
  }
  return { webOrigin: webUrl.origin, apiOrigin: apiUrl.origin, checked }
}

if (isDirectRun) {
  checkStagingReadiness()
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => {
      console.error(`[STAGING WEB REFUSED] ${error.message}`)
      process.exitCode = 1
    })
}
