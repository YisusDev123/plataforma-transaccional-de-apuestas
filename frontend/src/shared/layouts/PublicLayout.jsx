import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark.jsx'
import { Button, ButtonLink } from '../components/Button.jsx'

const publicLinks = [
  { label: 'Inicio', to: '/' },
  { label: 'Experiencia', to: '/app' },
  { label: 'Ayuda', to: '/ayuda' },
]

export function PublicLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="app-background relative overflow-hidden">
      <div className="grid-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <header className="relative z-20 border-b border-white/[0.08] bg-night-950/70 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-5 px-5 sm:px-7 lg:px-10">
          <Link to="/" aria-label="Ir al inicio"><BrandMark /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación pública">
            {publicLinks.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `rounded-xl px-4 py-2.5 text-sm font-bold transition ${isActive ? 'bg-white/[0.08] text-white' : 'text-[#aeb4cd] hover:text-white'}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <ButtonLink variant="ghost" to="/login">Entrar</ButtonLink>
            <ButtonLink variant="success" to="/registro">Crear cuenta</ButtonLink>
          </div>
          <Button className="size-11 px-0 md:hidden" variant="secondary" aria-expanded={menuOpen} aria-controls="public-mobile-menu" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </Button>
        </div>
        {menuOpen && (
          <nav className="border-t border-white/[0.08] px-5 py-4 md:hidden" id="public-mobile-menu" aria-label="Navegación pública móvil">
            <div className="mx-auto grid max-w-7xl gap-2">
              {publicLinks.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 font-bold text-[#c8cde0] hover:bg-white/[0.07] hover:text-white">{item.label}</NavLink>)}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <ButtonLink variant="secondary" to="/login">Entrar</ButtonLink>
                <ButtonLink variant="success" to="/registro">Crear cuenta</ButtonLink>
              </div>
            </div>
          </nav>
        )}
      </header>
      <main className="relative z-10">{children}</main>
      <footer className="relative z-10 border-t border-white/[0.08] px-5 py-8">
        <div className="mx-auto flex max-w-7xl text-sm text-muted">
          <BrandMark compact />
        </div>
      </footer>
    </div>
  )
}
