import { forwardRef } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45'
const variants = {
  primary: 'bg-electric-500 text-white shadow-lg shadow-electric-500/20 hover:bg-electric-400 active:translate-y-px',
  success: 'bg-jade-400 !text-[#070816] shadow-lg shadow-jade-400/15 hover:bg-[#52ebba] active:translate-y-px',
  secondary: 'border border-white/12 bg-white/[0.07] text-white hover:border-white/25 hover:bg-white/[0.11]',
  ghost: 'text-[#c9cee3] hover:bg-white/[0.07] hover:text-white',
  danger: 'bg-coral-400 !text-[#070816] hover:bg-[#ff8792]',
}

function buttonClassName(variant = 'primary', className = '') {
  return `${base} ${variants[variant] || variants.primary} ${className}`.trim()
}

export const Button = forwardRef(function Button({ children, className = '', disabled = false, loading = false, variant = 'primary', type = 'button', ...props }, ref) {
  return (
    <button ref={ref} className={buttonClassName(variant, className)} type={type} disabled={loading || disabled} {...props}>
      {loading && <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />}
      {children}
    </button>
  )
})

export function ButtonLink({ children, className = '', variant = 'primary', ...props }) {
  return <Link className={buttonClassName(variant, className)} {...props}>{children}</Link>
}
