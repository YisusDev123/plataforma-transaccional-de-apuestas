import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { OfflineProtectedPage } from './OfflineProtectedPage.jsx'

const pwaMock = vi.hoisted(() => ({ handlers: null }))

vi.mock('./pwa-registration.js', () => ({
  registerPwaWorker: vi.fn(async (handlers) => {
    pwaMock.handlers = handlers
    return () => {}
  }),
  activateWaitingWorker: vi.fn((worker) => {
    worker.postMessage({ type: 'SKIP_WAITING' })
    return true
  }),
}))

import { PwaExperience } from './PwaExperience.jsx'
import { activateWaitingWorker } from './pwa-registration.js'

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

function renderExperience(queryClient = new QueryClient()) {
  return render(<QueryClientProvider client={queryClient}><PwaExperience /></QueryClientProvider>)
}

function PendingMutation() {
  const { mutate } = useMutation({ mutationFn: () => new Promise(() => {}) })
  useEffect(() => mutate(), [mutate])
  return null
}

describe('experiencia PWA segura', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setOnline(true)
    pwaMock.handlers = null
  })

  afterEach(() => setOnline(true))

  test('al quedar offline informa y elimina consultas remotas en memoria', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['wallet', 'balance'], { available_balance: '25000.00' })
    renderExperience(queryClient)

    act(() => setOnline(false))

    expect(await screen.findByText(/Sin conexión: las operaciones/)).toBeInTheDocument()
    await waitFor(() => expect(queryClient.getQueryData(['wallet', 'balance'])).toBeUndefined())
  })

  test('ofrece instalación sólo después del evento del navegador', async () => {
    renderExperience()
    expect(screen.queryByRole('button', { name: /Instalar Loto Demo/ })).not.toBeInTheDocument()
    const event = new Event('beforeinstallprompt')
    event.prompt = vi.fn(async () => {})
    event.userChoice = Promise.resolve({ outcome: 'accepted' })

    act(() => window.dispatchEvent(event))
    fireEvent.click(await screen.findByRole('button', { name: /Instalar Loto Demo/ }))

    await waitFor(() => expect(event.prompt).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: /Instalar Loto Demo/ })).not.toBeInTheDocument()
  })

  test('una versión nueva espera confirmación explícita', async () => {
    const worker = { postMessage: vi.fn() }
    renderExperience()
    await waitFor(() => expect(pwaMock.handlers).not.toBeNull())

    act(() => pwaMock.handlers.onWaiting(worker))
    expect(await screen.findByText('Nueva versión disponible')).toBeInTheDocument()
    expect(activateWaitingWorker).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Actualizar ahora/ }))
    expect(activateWaitingWorker).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  test('no permite activar una actualización durante una mutación', async () => {
    const worker = { postMessage: vi.fn() }
    const queryClient = new QueryClient()
    render(<QueryClientProvider client={queryClient}><PendingMutation /><PwaExperience /></QueryClientProvider>)
    await waitFor(() => expect(queryClient.isMutating()).toBe(1))
    act(() => pwaMock.handlers.onWaiting(worker))

    expect(await screen.findByText(/Espera a que termine la operación/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Actualizar ahora/ })).toBeDisabled()
    expect(activateWaitingWorker).not.toHaveBeenCalled()
  })

  test('la pantalla privada offline no presenta datos financieros', () => {
    render(<OfflineProtectedPage />)
    expect(screen.getByRole('heading', { name: 'Conexión necesaria' })).toBeInTheDocument()
    expect(screen.getByText(/no mostramos saldos, sorteos ni operaciones/)).toBeInTheDocument()
    expect(screen.getByText(/No se enviará ninguna operación automáticamente/)).toBeInTheDocument()
  })
})
