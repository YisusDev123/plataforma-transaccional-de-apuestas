import { useId } from 'react'

export function FormField({ error, hint, id: providedId, label, ...props }) {
  const generatedId = useId()
  const id = providedId || generatedId
  const descriptionId = `${id}-description`
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-[#e8eaf6]" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="min-h-12 rounded-xl border border-white/12 bg-night-950/65 px-4 text-base text-white placeholder:text-[#727a9d] hover:border-white/20 focus:border-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-500/25"
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? descriptionId : undefined}
        {...props}
      />
      {(error || hint) && (
        <p id={descriptionId} className={`text-xs leading-5 ${error ? 'text-[#ff9ba5]' : 'text-muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
