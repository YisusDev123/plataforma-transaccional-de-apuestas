import { Sparkles } from 'lucide-react'

export function BrandMark({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-3" aria-label="Loto Demo" role="img">
      <span className="brand-shadow grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-electric-400 to-electric-500 text-white">
        <Sparkles size={20} aria-hidden="true" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-base font-black tracking-[0.08em] text-white">Loto Demo</span>
          <span className="mt-1 block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-jade-400">Jugadas claras</span>
        </span>
      )}
    </span>
  )
}
