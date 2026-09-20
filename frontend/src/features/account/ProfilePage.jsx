import { AtSign, BadgeCheck, IdCard, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth.js'
import { KycPanel } from '../kyc/KycPanel.jsx'
import { KycStatusBadge } from '../kyc/KycStatusBadge.jsx'
import { DetailList } from '../../shared/components/DetailList.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'

export function ProfilePage() {
  const { user } = useAuth()
  return (
    <PlayerPage>
      <PageHeader eyebrow="Cuenta" title="Perfil y verificación" subtitle="Consulta el estado actual de tu cuenta y completa la verificación de identidad cuando corresponda." />
      <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <article className="surface-soft rounded-3xl p-5 sm:p-7">
          <span className="grid size-12 place-items-center rounded-2xl bg-jade-400/10 text-jade-400"><UserRound size={23} aria-hidden="true" /></span>
          <h2 className="mt-4 text-xl font-black text-white">Datos de la cuenta</h2>
          <div className="mt-5"><DetailList items={[
            { label: 'Nombre completo', value: <span className="inline-flex items-center gap-2"><UserRound size={15} aria-hidden="true" />{user.fullName || 'No disponible'}</span> },
            { label: 'Cédula', value: <span className="inline-flex items-center gap-2"><IdCard size={15} aria-hidden="true" />{user.dni || 'No disponible'}</span> },
            { label: 'Correo electrónico', value: <span className="inline-flex items-center gap-2"><AtSign size={15} aria-hidden="true" />{user.email}</span> },
            { label: 'Estado de cuenta', value: <StatusBadge status={user.status} /> },
            { label: 'Correo verificado', value: <span className="inline-flex items-center gap-2"><BadgeCheck size={15} aria-hidden="true" />{user.emailVerified ? 'Sí' : 'No'}</span> },
            { label: 'Verificación de identidad', value: <span className="inline-flex items-center gap-2"><ShieldCheck size={15} aria-hidden="true" /><KycStatusBadge status={user.kycStatus} /></span> },
          ]} /></div>
        </article>
        <section aria-label="Verificación de identidad"><KycPanel status={user.kycStatus} /></section>
      </section>
    </PlayerPage>
  )
}
