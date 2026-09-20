import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useId, useState } from 'react'

export const PasswordField = forwardRef(function PasswordField({ error, hint, id: providedId, label, ...props }, ref) {
  const generatedId = useId()
  const [visible, setVisible] = useState(false)
  const id = providedId || generatedId
  const descriptionId = `${id}-description`
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-[#e8eaf6]" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          {...props}
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          className="min-h-12 w-full rounded-xl border border-white/12 bg-night-950/65 px-4 pr-12 text-base text-white placeholder:text-[#727a9d] hover:border-white/20 focus:border-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-500/25"
          aria-invalid={Boolean(error)}
          aria-describedby={hint || error ? descriptionId : undefined}
        />
        <button className="absolute inset-y-1 right-1 grid w-10 place-items-center rounded-lg text-[#8e96b6] hover:bg-white/[0.06] hover:text-white" type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      </div>
      {(error || hint) && <p id={descriptionId} className={`text-xs leading-5 ${error ? 'text-[#ff9ba5]' : 'text-muted'}`}>{error || hint}</p>}
    </div>
  )
})
