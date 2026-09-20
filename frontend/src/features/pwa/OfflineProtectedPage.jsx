import { CloudOff } from 'lucide-react'
import { BrandMark } from '../../shared/components/BrandMark.jsx'

export function OfflineProtectedPage({ scope = 'player' }) {
  return (
    <main className="app-background grid min-h-screen place-items-center p-6">
      <section className="surface-card w-full max-w-xl rounded-3xl p-7 text-center sm:p-10" role="status" aria-live="polite">
        <BrandMark />
        <span className="mx-auto mt-8 grid size-16 place-items-center rounded-2xl bg-gold-400/10 text-gold-400"><CloudOff size={30} aria-hidden="true" /></span>
        <h1 className="mt-6 text-2xl font-black text-white">Conexión necesaria</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          {scope === 'admin'
            ? 'El panel administrativo no muestra información almacenada cuando no hay conexión. Reconecta para consultar datos vigentes.'
            : 'Por seguridad, no mostramos saldos, sorteos ni operaciones guardadas cuando no hay conexión. Reconecta para consultar información vigente.'}
        </p>
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-gold-400">No se enviará ninguna operación automáticamente</p>
      </section>
    </main>
  )
}
