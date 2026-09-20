import { ArrowRight, CircleGauge, Clock3, ShieldCheck, UsersRound } from 'lucide-react'
import { AdminLayout } from '../shared/layouts/AdminLayout.jsx'
import { Alert } from '../shared/components/Alert.jsx'
import { Badge } from '../shared/components/Badge.jsx'
import { ButtonLink } from '../shared/components/Button.jsx'
import { PageHeader } from '../shared/components/PageHeader.jsx'
import { PageState } from '../shared/components/PageState.jsx'

const metrics = [
  { icon: UsersRound, label: 'Usuarios', tone: 'text-electric-400' },
  { icon: Clock3, label: 'Revisiones pendientes', tone: 'text-gold-400' },
  { icon: ShieldCheck, label: 'Operaciones protegidas', tone: 'text-jade-400' },
]

export function AdminPreviewPage() {
  return (
    <AdminLayout>
      <PageHeader eyebrow="Operación interna" title="Resumen administrativo" subtitle="Una superficie sobria para revisar estados y ejecutar acciones autorizadas con precisión." actions={<ButtonLink variant="secondary" to="/login">Acceso administrativo <ArrowRight size={17} aria-hidden="true" /></ButtonLink>} />
      <Alert title="Autorización pendiente" variant="warning"><p>Esta vista no ejecuta acciones. Roles, permisos y datos reales se conectarán en la fase administrativa.</p></Alert>
      <section className="mt-7 grid gap-4 md:grid-cols-3" aria-label="Indicadores administrativos">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return <article className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5" key={metric.label}><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#aeb4ca]">{metric.label}</p><Icon className={metric.tone} size={20} aria-hidden="true" /></div><p className="mt-5 text-3xl font-black">—</p><Badge variant="neutral">Sin conexión</Badge></article>
        })}
      </section>
      <section className="mt-7 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-6">
        <div className="mb-5 flex items-center gap-3"><CircleGauge className="text-electric-400" size={21} aria-hidden="true" /><h2 className="text-lg font-black">Cola de trabajo</h2></div>
        <PageState title="No hay datos operativos">
          Las solicitudes administrativas aparecerán únicamente después de autenticar un rol vigente.
        </PageState>
      </section>
    </AdminLayout>
  )
}
