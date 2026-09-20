import { Ban, CloudAlert, Inbox, ShieldX } from 'lucide-react'
import { Button, ButtonLink } from './Button.jsx'

const variants = {
  empty: { icon: Inbox, title: 'Todavía no hay información' },
  error: { icon: CloudAlert, title: 'No pudimos cargar esta sección' },
  forbidden: { icon: ShieldX, title: 'No tienes permiso para entrar' },
  busy: { icon: Ban, title: 'El servicio está ocupado' },
}

export function PageState({ actionLabel, actionTo = '/', children, onAction, title, variant = 'empty' }) {
  const config = variants[variant] || variants.empty
  const Icon = config.icon
  return (
    <section className="surface-soft grid min-h-56 place-items-center rounded-3xl p-7 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/[0.07] text-electric-400">
          <Icon size={23} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-xl font-black text-white">{title || config.title}</h2>
        {children && <div className="mt-2 text-sm leading-6 text-muted">{children}</div>}
        {actionLabel && (onAction
          ? <Button className="mt-5" onClick={onAction}>{actionLabel}</Button>
          : <ButtonLink className="mt-5" to={actionTo}>{actionLabel}</ButtonLink>)}
      </div>
    </section>
  )
}
