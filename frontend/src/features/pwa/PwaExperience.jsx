import { useEffect, useState } from 'react'
import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'
import { Button } from '../../shared/components/Button.jsx'
import { activateWaitingWorker, registerPwaWorker } from './pwa-registration.js'
import { useOnlineStatus } from './online-status.js'

export function PwaExperience() {
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const activeMutations = useIsMutating()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [waitingWorker, setWaitingWorker] = useState(null)
  const [offlineReady, setOfflineReady] = useState(false)
  const [applyingUpdate, setApplyingUpdate] = useState(false)

  useEffect(() => {
    const onInstallAvailable = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const onInstalled = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', onInstallAvailable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallAvailable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    let cleanup = () => {}
    let active = true
    registerPwaWorker({
      onOfflineReady: () => { if (active) setOfflineReady(true) },
      onWaiting: (worker) => { if (active) setWaitingWorker(worker) },
    }).then((dispose) => {
      if (active) cleanup = dispose
      else dispose()
    }).catch(() => {})
    return () => { active = false; cleanup() }
  }, [])

  useEffect(() => {
    if (!online) queryClient.removeQueries()
  }, [online, queryClient])

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const update = () => {
    if (activeMutations > 0 || !waitingWorker) return
    setApplyingUpdate(true)
    const started = activateWaitingWorker(waitingWorker, () => window.location.reload())
    if (!started) setApplyingUpdate(false)
  }

  return (
    <>
      {!online && (
        <div className="fixed inset-x-0 top-0 z-[80] flex min-h-10 items-center justify-center gap-2 bg-gold-400 px-4 py-2 text-center text-sm font-black text-[#090b15]" role="status" aria-live="assertive">
          <WifiOff size={17} aria-hidden="true" /> Sin conexión: las operaciones y los datos privados están deshabilitados
        </div>
      )}

      {(waitingWorker || offlineReady) && (
        <aside className="surface-card fixed bottom-24 right-4 z-[70] w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-4 shadow-2xl lg:bottom-6" aria-live="polite">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-black text-white">{waitingWorker ? 'Nueva versión disponible' : 'Acceso básico sin conexión listo'}</p>
              <p className="mt-1 text-sm leading-5 text-muted">
                {waitingWorker
                  ? activeMutations > 0 ? 'Espera a que termine la operación en curso para actualizar.' : 'Actualiza cuando estés listo. No recargaremos la página automáticamente.'
                  : 'La interfaz puede abrirse offline; los datos y las operaciones siempre requieren conexión.'}
              </p>
            </div>
            <button className="rounded-lg p-1 text-muted hover:bg-white/[0.08] hover:text-white" type="button" aria-label="Cerrar aviso" onClick={() => waitingWorker ? setWaitingWorker(null) : setOfflineReady(false)}><X size={18} aria-hidden="true" /></button>
          </div>
          {waitingWorker && <Button className="mt-4 w-full" disabled={activeMutations > 0} loading={applyingUpdate} onClick={update}><RefreshCw size={17} aria-hidden="true" /> Actualizar ahora</Button>}
        </aside>
      )}

      {installPrompt && online && !waitingWorker && (
        <Button className="fixed bottom-24 right-4 z-[60] shadow-2xl lg:bottom-6" variant="secondary" onClick={install}>
          <Download size={17} aria-hidden="true" /> Instalar Loto Demo
        </Button>
      )}
    </>
  )
}
