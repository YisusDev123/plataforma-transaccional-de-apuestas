import { LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { PublicLayout } from '../../../shared/layouts/PublicLayout.jsx'

export function AuthPageShell({ children, eyebrow, subtitle, title }) {
  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-7 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-10">
        <aside className="hidden lg:block">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-jade-400">Acceso protegido</p>
          <h1 className="text-gradient mt-4 text-5xl font-black leading-tight tracking-[-0.04em]">Tu cuenta, protegida en todo momento.</h1>
          <p className="mt-5 max-w-md leading-7 text-muted">Ingresa con confianza. Protegemos tu sesión y tus datos mientras utilizas la plataforma.</p>
          <div className="mt-8 grid gap-4">
            <p className="flex items-center gap-3 text-sm font-bold text-[#cbd0e3]"><ShieldCheck className="text-jade-400" size={20} aria-hidden="true" /> Verificamos tu identidad para proteger cada operación.</p>
            <p className="flex items-center gap-3 text-sm font-bold text-[#cbd0e3]"><LockKeyhole className="text-electric-400" size={20} aria-hidden="true" /> Tu acceso se mantiene protegido de forma segura.</p>
            <p className="flex items-center gap-3 text-sm font-bold text-[#cbd0e3]"><Sparkles className="text-gold-400" size={20} aria-hidden="true" /> Confirmamos cada movimiento importante antes de procesarlo.</p>
          </div>
        </aside>
        <div className="surface-panel mx-auto w-full max-w-xl rounded-[2rem] p-6 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-jade-400">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </section>
    </PublicLayout>
  )
}
