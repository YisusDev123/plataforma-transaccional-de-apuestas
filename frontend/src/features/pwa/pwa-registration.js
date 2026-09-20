const UPDATE_CHECK_INTERVAL_MS = 60 * 60_000

function observeInstallingWorker(registration, onWaiting, onOfflineReady) {
  const worker = registration.installing
  if (!worker) return
  worker.addEventListener('statechange', () => {
    if (worker.state !== 'installed') return
    if (navigator.serviceWorker.controller) onWaiting(worker)
    else onOfflineReady()
  })
}

export async function registerPwaWorker({ onOfflineReady, onWaiting }) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return () => {}

  const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
  if (registration.waiting) onWaiting(registration.waiting)

  const onUpdateFound = () => observeInstallingWorker(registration, onWaiting, onOfflineReady)
  const checkForUpdate = async () => {
    await registration.update()
    if (registration.waiting) onWaiting(registration.waiting)
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') checkForUpdate().catch(() => {})
  }
  registration.addEventListener('updatefound', onUpdateFound)
  document.addEventListener('visibilitychange', onVisible)
  const interval = window.setInterval(() => checkForUpdate().catch(() => {}), UPDATE_CHECK_INTERVAL_MS)

  return () => {
    registration.removeEventListener('updatefound', onUpdateFound)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(interval)
  }
}

export function activateWaitingWorker(worker, onActivated) {
  if (!worker || !('serviceWorker' in navigator)) return false
  navigator.serviceWorker.addEventListener('controllerchange', onActivated, { once: true })
  worker.postMessage({ type: 'SKIP_WAITING' })
  return true
}
