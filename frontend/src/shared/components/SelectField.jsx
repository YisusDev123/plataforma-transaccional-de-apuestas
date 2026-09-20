import { useId } from 'react'

export function SelectField({ error, id: providedId, label, options, ...props }) {
  const generatedId = useId()
  const id = providedId || generatedId
  const errorId = `${id}-error`
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-[#e8eaf6]" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="min-h-12 rounded-xl border border-white/12 bg-night-950/65 px-4 text-base text-white hover:border-white/20 focus:border-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-500/25"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {error && <p className="text-xs leading-5 text-[#ff9ba5]" id={errorId}>{error}</p>}
    </div>
  )
}
