import { BanknoteArrowDown, BanknoteArrowUp, Building2, ChartNoAxesCombined, ClipboardList, FileCheck2, LogOut, Percent, ReceiptText, Settings2, ShieldCheck, TicketCheck, UserCog, UsersRound } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAdminAuth } from '../../features/admin-auth/useAdminAuth.js'
import { Badge } from '../components/Badge.jsx'
import { BrandMark } from '../components/BrandMark.jsx'
import { Button } from '../components/Button.jsx'

const navigation = [
  { icon: ChartNoAxesCombined, label: 'Resumen', to: '/admin' },
  { icon: UsersRound, label: 'Usuarios', to: '/admin/usuarios' },
  { icon: FileCheck2, label: 'KYC', to: '/admin/kyc' },
  { icon: BanknoteArrowDown, label: 'Depósitos', to: '/admin/depositos' },
  { icon: Building2, label: 'Destinos de depósito', to: '/admin/destinos-deposito', role: 'SUPER_ADMIN' },
  { icon: BanknoteArrowUp, label: 'Retiros', to: '/admin/retiros' },
  { icon: ReceiptText, label: 'Apuestas', to: '/admin/apuestas' },
  { icon: TicketCheck, label: 'Sorteos', to: '/admin/sorteos' },
  { icon: ClipboardList, label: 'Lista', to: '/admin/lista' },
  { icon: Settings2, label: 'Reglas', to: '/admin/reglas', role: 'SUPER_ADMIN' },
  { icon: Percent, label: 'Multiplicadores', to: '/admin/multiplicadores', role: 'SUPER_ADMIN' },
  { icon: UserCog, label: 'Administradores', to: '/admin/administradores', role: 'SUPER_ADMIN' },
]

export function AdminLayout({ children }) {
  const { admin, logout } = useAdminAuth()
  const visibleNavigation = navigation.filter((item) => !item.role || item.role === admin.role)
  return <div className="min-h-screen bg-[#090b15] text-white lg:grid lg:grid-cols-[17rem_1fr]">
    <aside className="hidden border-r border-white/[0.08] bg-[#0d101d] p-5 lg:flex lg:flex-col" data-layout-navigation="desktop">
      <Link className="px-2 py-3" to="/"><BrandMark /></Link>
      <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
        <span className="grid size-10 place-items-center rounded-xl bg-electric-500/15 text-electric-400"><ShieldCheck size={20} aria-hidden="true" /></span>
        <div className="min-w-0"><p className="truncate text-sm font-bold">{admin.email}</p><Badge variant="accent">{admin.role === 'SUPER_ADMIN' ? 'Super admin' : 'Empleado'}</Badge></div>
      </div>
      <nav className="mt-6 grid gap-1" aria-label="Navegación administrativa">
        {visibleNavigation.map((item) => { const Icon = item.icon; return <NavLink key={item.to} end={item.to === '/admin'} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${isActive ? 'bg-white/[0.09] text-white' : 'text-[#939bb8] hover:bg-white/[0.05] hover:text-white'}`}><Icon size={18} aria-hidden="true" />{item.label}</NavLink> })}
      </nav>
      <div className="mt-auto grid gap-3"><p className="px-3 text-xs leading-5 text-[#737b98]">La autorización definitiva siempre pertenece a la API.</p><Button variant="ghost" onClick={logout}><LogOut size={17} aria-hidden="true" /> Cerrar sesión</Button></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#090b15]/90 backdrop-blur-xl lg:hidden">
        <div className="flex min-h-18 items-center justify-between px-5"><Link to="/"><BrandMark /></Link><Button className="min-h-9 px-3 py-1.5" variant="ghost" onClick={logout}><LogOut size={16} aria-hidden="true" /> Salir</Button></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3" aria-label="Navegación administrativa móvil" data-layout-navigation="mobile">
          {visibleNavigation.map((item) => <NavLink key={item.to} to={item.to} className="shrink-0 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-bold text-[#b5bad0]">{item.label}</NavLink>)}
        </nav>
      </header>
      <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-7 lg:px-10 lg:py-9">{children}</main>
    </div>
  </div>
}
