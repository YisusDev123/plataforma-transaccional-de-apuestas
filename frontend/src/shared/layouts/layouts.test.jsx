import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { AdminLayout } from './AdminLayout.jsx'
import { PlayerLayout } from './PlayerLayout.jsx'
import { PublicLayout } from './PublicLayout.jsx'
import { AdminAuthContext } from '../../features/admin-auth/admin-auth-context.js'

function renderLayout(component) {
  return render(<MemoryRouter>{component}</MemoryRouter>)
}

describe('layouts responsive', () => {
  test('el layout público incluye navegación de escritorio y control móvil accesible', () => {
    renderLayout(<PublicLayout><h1>Inicio</h1></PublicLayout>)
    expect(screen.getByRole('navigation', { name: 'Navegación pública' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Interfaz en desarrollo. Ninguna vista previa procesa dinero real.')).not.toBeInTheDocument()
  })

  test('el jugador expone navegación equivalente para escritorio y móvil', () => {
    const { container } = renderLayout(<PlayerLayout><h1>Jugador</h1></PlayerLayout>)
    expect(screen.getByRole('navigation', { name: 'Navegación de jugador' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegación de jugador móvil' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-layout-navigation]').length).toBe(2)
  })

  test('administración mantiene su navegación separada en ambos breakpoints', () => {
    const adminSession = { admin: { id: 1, email: 'admin@example.com', role: 'EMPLOYEE', status: 'ACTIVE' }, logout: () => {} }
    const { container } = renderLayout(<AdminAuthContext.Provider value={adminSession}><AdminLayout><h1>Administración</h1></AdminLayout></AdminAuthContext.Provider>)
    expect(screen.getByRole('navigation', { name: 'Navegación administrativa' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegación administrativa móvil' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-layout-navigation]').length).toBe(2)
  })
})
