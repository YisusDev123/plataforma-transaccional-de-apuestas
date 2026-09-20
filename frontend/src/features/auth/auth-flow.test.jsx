import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../App.jsx'

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function createAuthFetch() {
  let authenticated = false
  return vi.fn(async (url, options = {}) => {
    const path = new URL(url).pathname
    if (path === '/auth/me') {
      const authorization = new Headers(options.headers).get('Authorization')
      if (authenticated && authorization === 'Bearer access-1') {
        return jsonResponse(200, { body: { id: 7, email: 'usuario@example.com', emailVerified: true, status: 'ACTIVE', kycStatus: 'UNVERIFIED' } })
      }
      return jsonResponse(401, { success: false, message: 'Token no proporcionado' })
    }
    if (path === '/auth/refresh') return jsonResponse(400, { success: false, message: 'REFRESH TOKEN REQUERIDO' })
    if (path === '/auth/login') {
      authenticated = true
      return jsonResponse(200, { body: { accessToken: 'access-1', user: { id: 7, email: 'usuario@example.com' } } })
    }
    if (path === '/auth/logout') {
      authenticated = false
      return jsonResponse(200, { body: { message: 'SESIÓN CERRADA' } })
    }
    if (path === '/auth/register') return jsonResponse(201, { body: { message: 'USUARIO REGISTRADO EXITOSAMENTE' } })
    if (path === '/auth/verify-email') return jsonResponse(200, { body: { message: 'EMAIL VERIFICADO' } })
    if (path === '/auth/resend-verification') return jsonResponse(200, { body: { message: 'CÓDIGO GENERADO' } })
    if (path === '/auth/forgot-password') return jsonResponse(404, { success: false, message: 'USUARIO NO EXISTE' })
    if (path === '/auth/reset-password') return jsonResponse(200, { body: { message: 'CONTRASEÑA ACTUALIZADA' } })
    return jsonResponse(404, { message: 'No encontrado' })
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.stubGlobal('fetch', createAuthFetch())
})

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('flujo de autenticación', () => {
  test('inicia sesión, protege el destino y no persiste tokens', async () => {
    window.history.replaceState({}, '', '/login?returnTo=%2Fapp%2Ftickets')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(screen.getByText('Tu cuenta, protegida en todo momento.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa con confianza. Protegemos tu sesión y tus datos mientras utilizas la plataforma.')).toBeInTheDocument()
    expect(screen.queryByText(/JavaScript|refresh token|backend/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'usuario@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByRole('heading', { name: 'Mis tickets' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app/tickets')
    expect(JSON.stringify(localStorage)).not.toContain('access-1')
    expect(JSON.stringify(sessionStorage)).not.toContain('access-1')
  })

  test('redirige una ruta de jugador anónima conservando el retorno seguro', async () => {
    window.history.replaceState({}, '', '/app/billetera')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/app/billetera')
  })

  test('credenciales inválidas no disparan refresh ni reintentos automáticos', async () => {
    const baseFetch = createAuthFetch()
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      if (new URL(url).pathname === '/auth/login') return jsonResponse(401, { success: false, message: 'CREDENCIALES INVALIDAS' })
      return baseFetch(url, options)
    }))
    window.history.replaceState({}, '', '/login')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'usuario@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(await screen.findByText('CREDENCIALES INVALIDAS')).toBeInTheDocument()
    expect(fetch.mock.calls.filter(([url]) => new URL(url).pathname === '/auth/login')).toHaveLength(1)
    expect(fetch.mock.calls.filter(([url]) => new URL(url).pathname === '/auth/refresh')).toHaveLength(1)
  })

  test('restaura una sesión por cookie y permite cerrarla', async () => {
    let refreshed = false
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const path = new URL(url).pathname
      if (path === '/auth/refresh') {
        refreshed = true
        return jsonResponse(200, { body: { accessToken: 'restored-access' } })
      }
      if (path === '/auth/me' && refreshed && new Headers(options.headers).get('Authorization') === 'Bearer restored-access') {
        return jsonResponse(200, { body: { id: 8, email: 'restaurado@example.com', emailVerified: true, status: 'ACTIVE', kycStatus: 'APPROVED' } })
      }
      if (path === '/auth/me') return jsonResponse(401, { message: 'Sin access token' })
      if (path === '/auth/logout') return jsonResponse(200, { body: { message: 'SESIÓN CERRADA' } })
      return jsonResponse(404, { message: 'No encontrado' })
    }))
    window.history.replaceState({}, '', '/app')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Tu cuenta, al día' })).toBeInTheDocument()
    expect(screen.getByText('restaurado@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  test('registro elimina la confirmación del payload y lleva a verificación', async () => {
    window.history.replaceState({}, '', '/registro')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Crea tu acceso' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: '  NUEVO@EXAMPLE.COM ' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'secreto' } })
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(await screen.findByRole('heading', { name: 'Ingresa el código' })).toBeInTheDocument()
    const registerCall = fetch.mock.calls.find(([url]) => new URL(url).pathname === '/auth/register')
    expect(JSON.parse(registerCall[1].body)).toEqual({ email: 'nuevo@example.com', password: 'secreto' })
  })

  test('validación local impide enviar un formulario inválido', async () => {
    window.history.replaceState({}, '', '/registro')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Crea tu acceso' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeInTheDocument()
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => new URL(url).pathname === '/auth/register')).toBe(false))
  })

  test('verifica el correo usando el código de seis dígitos', async () => {
    window.history.replaceState({}, '', '/verificar-correo?email=usuario%40example.com')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Ingresa el código' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verificar correo/i }))
    expect(await screen.findByRole('heading', { name: 'Tu cuenta está verificada' })).toBeInTheDocument()
    const call = fetch.mock.calls.find(([url]) => new URL(url).pathname === '/auth/verify-email')
    expect(JSON.parse(call[1].body)).toEqual({ email: 'usuario@example.com', verificationCode: '123456' })
  })

  test('recuperación no revela si el correo está registrado', async () => {
    window.history.replaceState({}, '', '/olvide-contrasena')
    render(<App />)
    expect(await screen.findByRole('heading', { name: '¿Olvidaste tu contraseña?' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'desconocido@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /solicitar código/i }))
    expect(await screen.findByText(/si existe una cuenta válida/i)).toBeInTheDocument()
    expect(screen.queryByText('USUARIO NO EXISTE')).not.toBeInTheDocument()
  })

  test('restablece la contraseña sin enviar la confirmación al backend', async () => {
    window.history.replaceState({}, '', '/restablecer-contrasena?email=usuario%40example.com')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Cambia tu contraseña' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Código de recuperación'), { target: { value: '654321' } })
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nuevo-secreto' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'nuevo-secreto' } })
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }))
    expect(await screen.findByRole('heading', { name: 'Tu acceso fue restablecido' })).toBeInTheDocument()
    const call = fetch.mock.calls.find(([url]) => new URL(url).pathname === '/auth/reset-password')
    expect(JSON.parse(call[1].body)).toEqual({ email: 'usuario@example.com', resetCode: '654321', newPassword: 'nuevo-secreto' })
  })
})
