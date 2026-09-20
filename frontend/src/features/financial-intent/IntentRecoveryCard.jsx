import { useState } from 'react'
import { AlertTriangle, SearchCheck } from 'lucide-react'
import { Button } from '../../shared/components/Button.jsx'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.jsx'

export function IntentRecoveryCard({ canRetry = false, checkError, checking = false, intent, notFound = false, onAbandon, onCheck, onRetry, operationLabel }) {
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  if (!intent) return null
  return (
    <section className="surface-panel rounded-3xl border-gold-400/25 p-5 sm:p-6" aria-live="polite">
      <div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-400/10 text-gold-400"><AlertTriangle size={21} aria-hidden="true" /></span><div><h2 className="text-lg font-black text-white">Hay un {operationLabel} sin confirmar</h2><p className="mt-1 text-sm leading-6 text-muted">No crees otra operación hasta comprobar si la API registró esta intención.</p></div></div>
      <p className="mt-4 break-all rounded-xl bg-night-950/60 p-3 font-mono text-xs text-[#cfd3e5]">{intent.requestId}</p>
      {notFound && <p className="mt-3 text-sm text-gold-400">La consulta todavía no encontró la solicitud. Puedes reenviar exactamente los mismos datos con el mismo identificador.</p>}
      {checkError && <p className="mt-3 text-sm text-[#ff9ba5]">No pudimos comprobar el estado. La intención continúa protegida.</p>}
      <div className="mt-5 flex flex-wrap gap-3"><Button loading={checking} onClick={onCheck}><SearchCheck size={17} aria-hidden="true" /> Comprobar estado</Button>{canRetry && <Button variant="secondary" onClick={onRetry}>Reintentar la misma solicitud</Button>}{notFound && <Button variant="ghost" onClick={() => setConfirmAbandon(true)}>Descartar intención</Button>}</div>
      <ConfirmDialog open={confirmAbandon} title="¿Descartar esta intención?" confirmLabel="Descartar identificador" onClose={() => setConfirmAbandon(false)} onConfirm={() => { setConfirmAbandon(false); onAbandon() }}><p>Hazlo únicamente si confirmaste que no existe en el historial. Una operación que aún esté procesándose podría aparecer después.</p></ConfirmDialog>
    </section>
  )
}
