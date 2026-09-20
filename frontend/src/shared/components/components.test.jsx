import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { Button } from './Button.jsx'
import { ConfirmDialog } from './ConfirmDialog.jsx'
import { DataTable } from './DataTable.jsx'
import { FormField } from './FormField.jsx'
import { Pagination } from './Pagination.jsx'
import { PageState } from './PageState.jsx'
import { SelectField } from './SelectField.jsx'
import { CardSkeleton } from './Skeleton.jsx'

function withRouter(component) {
  return <MemoryRouter>{component}</MemoryRouter>
}

describe('componentes base', () => {
  test('el botón de carga evita envíos duplicados', () => {
    render(<Button loading>Procesando</Button>)
    const button = screen.getByRole('button', { name: 'Procesando' })
    expect(button).toBeDisabled()
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  test('el campo asocia etiqueta, ayuda y error accesible', () => {
    const { rerender } = render(<FormField label="Monto" hint="Usa colones" />)
    expect(screen.getByLabelText('Monto')).toHaveAccessibleDescription('Usa colones')
    rerender(<FormField label="Monto" error="Monto inválido" />)
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Monto')).toHaveAccessibleDescription('Monto inválido')
  })

  test('la paginación respeta límites y emite la página siguiente', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  test('el selector conserva etiqueta y opciones semánticas', () => {
    render(<SelectField label="Estado" options={[{ value: '', label: 'Todos' }, { value: 'PENDING', label: 'Pendiente' }]} />)
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pendiente' })).toHaveValue('PENDING')
  })

  test('tabla y skeleton comunican su estructura a tecnologías de asistencia', () => {
    render(<><DataTable caption="Movimientos" columns={[{ key: 'amount', label: 'Monto' }]} rows={[{ id: 1, amount: '₡10.00' }]} /><CardSkeleton /></>)
    expect(screen.getByRole('table', { name: 'Movimientos' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '₡10.00' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Cargando contenido' })).toBeInTheDocument()
  })

  test('los estados comunes ofrecen una salida navegable', () => {
    render(withRouter(<PageState variant="busy" actionLabel="Volver">Intenta nuevamente en unos segundos.</PageState>))
    expect(screen.getByRole('heading', { name: 'El servicio está ocupado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/')
  })
})

describe('diálogo de confirmación', () => {
  test('recibe foco y puede cerrarse con Escape', () => {
    const onClose = vi.fn()
    render(<ConfirmDialog open title="Confirmar operación" onClose={onClose} onConfirm={vi.fn()}>Revisa el monto.</ConfirmDialog>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('conserva el foco en un campo controlado mientras el usuario escribe', () => {
    function DialogWithField() {
      const [reason, setReason] = useState('')
      return <ConfirmDialog open title="Suspender usuario" onClose={() => {}} onConfirm={() => {}}><FormField label="Motivo obligatorio" value={reason} onChange={(event) => setReason(event.target.value)} /></ConfirmDialog>
    }

    render(<DialogWithField />)
    const field = screen.getByLabelText('Motivo obligatorio')
    expect(field).toHaveFocus()
    fireEvent.change(field, { target: { value: 'A' } })
    expect(field).toHaveValue('A')
    expect(field).toHaveFocus()
    fireEvent.change(field, { target: { value: 'Actividad revisada' } })
    expect(field).toHaveValue('Actividad revisada')
    expect(field).toHaveFocus()
  })
})
