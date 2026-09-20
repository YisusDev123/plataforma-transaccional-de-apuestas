import { ArrowRight, CircleDollarSign, Clock3, ShieldCheck, TicketCheck, WalletCards } from 'lucide-react'
import { PublicLayout } from '../shared/layouts/PublicLayout.jsx'
import { Badge } from '../shared/components/Badge.jsx'
import { ButtonLink } from '../shared/components/Button.jsx'

const features = [
  { icon: WalletCards, title: 'Tu dinero, visible', text: 'Saldo, movimientos y estados presentados con claridad, sin cifras escondidas.' },
  { icon: TicketCheck, title: 'Tickets trazables', text: 'Cada jugada tendrá su comprobante, detalle e historial en un solo lugar.' },
  { icon: Clock3, title: 'Horarios oficiales', text: 'Los cierres se muestran con la zona horaria del negocio, no la del dispositivo.' },
]

export function HomePage() {
  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-7 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-24">
        <div>
          <Badge variant="accent">Experiencia web en construcción</Badge>
          <h1 className="text-gradient mt-7 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            Tu próxima jugada, simple y segura.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Una plataforma local para consultar sorteos, preparar apuestas y mantener cada movimiento bajo control.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink className="sm:min-w-40" variant="success" to="/registro">Crear cuenta <ArrowRight size={18} aria-hidden="true" /></ButtonLink>
            <ButtonLink className="sm:min-w-40" variant="secondary" to="/app">Ver experiencia</ButtonLink>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#b8bed4]">
            <span className="flex items-center gap-2"><ShieldCheck className="text-jade-400" size={18} aria-hidden="true" /> Sesión protegida</span>
            <span className="flex items-center gap-2"><CircleDollarSign className="text-gold-400" size={18} aria-hidden="true" /> Importes claros</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-8 rounded-full bg-electric-500/12 blur-3xl" aria-hidden="true" />
          <section className="surface-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7" aria-label="Vista previa de boleto">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-electric-500 via-jade-400 to-gold-400" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.2em] text-jade-400">Vista previa</p><h2 className="mt-2 text-2xl font-black text-white">Prepara tu boleto</h2></div>
              <Badge variant="warning">Sin enviar</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">Los números son una muestra visual. Ninguna apuesta será procesada desde esta pantalla.</p>
            <div className="mt-7 grid grid-cols-4 gap-3" aria-label="Números de muestra">
              {['04', '17', '28', '63'].map((number, index) => (
                <span className={`grid aspect-square place-items-center rounded-2xl border text-lg font-black ${index === 1 ? 'border-jade-400/30 bg-jade-400/15 text-jade-400' : 'border-white/10 bg-white/[0.055] text-white'}`} key={number}>{number}</span>
              ))}
            </div>
            <div className="surface-soft mt-6 flex items-center justify-between rounded-2xl p-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Total actual</p><p className="mt-1 text-2xl font-black text-white">₡0.00</p></div>
              <span className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-muted">Sin apuestas</span>
            </div>
          </section>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-7 lg:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <article className="surface-soft rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-white/20" key={feature.title}>
                <span className="grid size-11 place-items-center rounded-2xl bg-electric-500/13 text-electric-400"><Icon size={21} aria-hidden="true" /></span>
                <h2 className="mt-5 text-lg font-black text-white">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.text}</p>
              </article>
            )
          })}
        </div>
      </section>
    </PublicLayout>
  )
}
