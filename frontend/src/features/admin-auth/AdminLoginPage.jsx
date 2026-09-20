import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAdminAuth } from './useAdminAuth.js'
import { safeAdminReturnTo } from './admin-navigation.js'
import { loginFormSchema } from '../auth/auth-schemas.js'
import { AuthError } from '../auth/components/AuthFeedback.jsx'
import { PasswordField } from '../auth/components/PasswordField.jsx'
import { BrandMark } from '../../shared/components/BrandMark.jsx'
import { Button } from '../../shared/components/Button.jsx'
import { FormField } from '../../shared/components/FormField.jsx'

export function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const form = useForm({ resolver: zodResolver(loginFormSchema), defaultValues: { email: '', password: '' } })
  const mutation = useMutation({ mutationFn: login, onSuccess: () => navigate(safeAdminReturnTo(searchParams.get('returnTo')), { replace: true }) })

  return <main className="app-background grid min-h-screen place-items-center px-4 py-10">
    <section className="surface-panel w-full max-w-md rounded-3xl p-6 sm:p-8" aria-labelledby="admin-login-title">
      <div className="flex items-center justify-between gap-4"><BrandMark /><span className="grid size-11 place-items-center rounded-2xl bg-electric-500/15 text-electric-400"><ShieldCheck size={22} aria-hidden="true" /></span></div>
      <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-electric-400">Acceso interno</p>
      <h1 className="mt-2 text-3xl font-black text-white" id="admin-login-title">Panel administrativo</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Ingresa con una cuenta administrativa activa. Las sesiones de jugador y administración permanecen separadas.</p>
      <form className="mt-7 grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <AuthError error={mutation.error} fallback="Revisa tus credenciales administrativas." />
        <FormField label="Correo administrativo" type="email" autoComplete="username" error={form.formState.errors.email?.message} {...form.register('email')} />
        <PasswordField label="Contraseña" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register('password')} />
        <Button className="w-full" loading={mutation.isPending} type="submit">Entrar al panel <ArrowRight size={18} aria-hidden="true" /></Button>
      </form>
      <Link className="mt-6 block text-center text-sm font-bold text-muted hover:text-white" to="/">Volver al sitio público</Link>
    </section>
  </main>
}
