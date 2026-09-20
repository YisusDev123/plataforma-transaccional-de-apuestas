const variants = {
  neutral: 'border-white/10 bg-white/[0.07] text-[#c8cde0]',
  success: 'border-jade-400/20 bg-jade-400/10 text-jade-400',
  warning: 'border-gold-400/20 bg-gold-400/10 text-gold-400',
  danger: 'border-coral-400/20 bg-coral-400/10 text-[#ff8b96]',
  accent: 'border-electric-400/25 bg-electric-500/15 text-[#b9a8ff]',
}

export function Badge({ children, variant = 'neutral' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${variants[variant] || variants.neutral}`}>
      {children}
    </span>
  )
}
