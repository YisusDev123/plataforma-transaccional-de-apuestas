import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import App from './App.jsx'

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

describe('aplicación', () => {
  test('presenta una experiencia pública clara sin fingir operaciones reales', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Tu próxima jugada, simple y segura.' })).toBeInTheDocument()
    expect(screen.getByText(/ninguna apuesta será procesada/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /crear cuenta/i }).every((link) => link.getAttribute('href') === '/registro')).toBe(true)
  })

  test('una ruta desconocida muestra una respuesta coherente', () => {
    window.history.replaceState({}, '', '/ninguna')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Esta página no existe' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Ir al inicio' }).some((link) => link.getAttribute('href') === '/')).toBe(true)
  })
})
