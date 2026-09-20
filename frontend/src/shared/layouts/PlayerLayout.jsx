import { CircleUserRound, House, LogOut, Ticket, WalletCards, Zap } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark.jsx'
import { Button, ButtonLink } from '../components/Button.jsx'

const navigation = [
  { icon: House, label: 'Inicio', to: '/app' },
  { icon: Zap, label: 'Jugar', to: '/app/jugar' },
  { icon: WalletCards, label: 'Billetera', to: '/app/billetera', activePrefixes: ['/app/depositos', '/app/retiros'] },
  { icon: Ticket, label: 'Tickets', to: '/app/tickets' },
  { icon: CircleUserRound, label: 'Perfil', to: '/app/perfil' },
]

function NavigationItem({ compact = false, item }) {
  const Icon = item.icon
  const location = useLocation()
  const relatedActive = item.activePrefixes?.some((prefix) => location.pathname.startsWith(prefix))
  return (
    <NavLink to={item.to} end={item.to === '/app'} className={({ isActive }) => `${compact ? 'min-w-16 px-2 py-2' : 'w-full px-4 py-3'} flex flex-col items-center gap-1 rounded-xl text-xs font-bold transition lg:flex-row lg:gap-3 lg:text-sm ${isActive || relatedActive ? 'bg-electric-500 text-white shadow-lg shadow-electric-500/15' : 'text-[#949cbd] hover:bg-white/[0.06] hover:text-white'}`}>
      <Icon size={19} aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  )
}

export function PlayerLayout({ children, logoutPending = false, onLogout, user }) {
  return (
    <div className="app-background min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-white/[0.08] bg-night-950/75 p-5 backdrop-blur-xl lg:flex lg:flex-col" data-layout-navigation="desktop">
        <Link className="px-2 py-3" to="/"><BrandMark /></Link>
        <nav className="mt-8 grid gap-2" aria-label="Navegación de jugador">
          {navigation.map((item) => <NavigationItem item={item} key={item.to} />)}
        </nav>
        {user ? (
          <div className="surface-soft mt-auto rounded-2xl p-4">
            <p className="truncate text-sm font-bold text-white">{user.email}</p>
            <p className="mt-1 text-xs text-muted">Sesión de jugador</p>
            <Button className="mt-4 w-full" variant="secondary" loading={logoutPending} onClick={onLogout}><LogOut size={17} aria-hidden="true" /> Salir</Button>
          </div>
        ) : (
          <div className="surface-soft mt-auto rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gold-400">Vista previa</p>
            <p className="mt-2 text-sm leading-5 text-muted">Inicia sesión para consultar datos reales.</p>
            <ButtonLink className="mt-4 w-full" variant="secondary" to="/login">Ir a acceso</ButtonLink>
          </div>
        )}
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between border-b border-white/[0.08] bg-night-950/80 px-5 backdrop-blur-xl lg:hidden">
          <Link to="/"><BrandMark /></Link>
          {user ? <Button className="size-11 px-0" variant="secondary" loading={logoutPending} onClick={onLogout} aria-label="Cerrar sesión"><LogOut size={18} aria-hidden="true" /></Button> : <ButtonLink variant="secondary" to="/login">Entrar</ButtonLink>}
        </header>
        <main className="mx-auto max-w-[92rem] px-4 pb-28 pt-6 sm:px-7 lg:px-10 lg:pb-10 lg:pt-9">{children}</main>
      </div>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/[0.1] bg-night-950/95 px-2 pt-2 backdrop-blur-xl lg:hidden" aria-label="Navegación de jugador móvil" data-layout-navigation="mobile">
        {navigation.map((item) => <NavigationItem compact item={item} key={item.to} />)}
      </nav>
    </div>
  )
}
