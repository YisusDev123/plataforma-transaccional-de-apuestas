import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

const variants = {
  info: { icon: Info, classes: 'border-electric-400/20 bg-electric-500/10 text-[#d7d0ff]' },
  success: { icon: CircleCheck, classes: 'border-jade-400/20 bg-jade-400/10 text-[#bdf8e5]' },
  warning: { icon: TriangleAlert, classes: 'border-gold-400/25 bg-gold-400/10 text-[#ffe4a3]' },
  danger: { icon: CircleAlert, classes: 'border-coral-400/25 bg-coral-400/10 text-[#ffc1c7]' },
}

export function Alert({ children, title, variant = 'info' }) {
  const config = variants[variant] || variants.info
  const Icon = config.icon
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 ${config.classes}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
      <div>
        {title && <p className="font-bold text-white">{title}</p>}
        <div className="mt-0.5 text-sm leading-6">{children}</div>
      </div>
    </div>
  )
}
