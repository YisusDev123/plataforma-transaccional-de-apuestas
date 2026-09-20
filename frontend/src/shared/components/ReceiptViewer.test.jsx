import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ReceiptViewer } from './ReceiptViewer.jsx'

afterEach(() => vi.unstubAllGlobals())

describe('visor privado de comprobantes', () => {
  test('crea y revoca una URL temporal para visualizar y descargar', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:receipt-1')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const loadReceipt = vi.fn().mockResolvedValue({
      blob: new Blob(['%PDF-test'], { type: 'application/pdf' }),
      filename: 'comprobante-ABC.pdf',
    })

    const view = render(<ReceiptViewer loadReceipt={loadReceipt} title="Comprobante privado" />)
    expect(await screen.findByTitle('Comprobante privado')).toHaveAttribute('src', 'blob:receipt-1')
    expect(loadReceipt).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Descargar' })).toHaveAttribute('download', 'comprobante-ABC.pdf')
    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt-1')
  })

  test('permite reintentar cuando la generación falla', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:receipt-2'), revokeObjectURL: vi.fn() })
    const loadReceipt = vi.fn()
      .mockRejectedValueOnce(new Error('Temporal'))
      .mockResolvedValueOnce({ blob: new Blob(['pdf']), filename: 'comprobante.pdf' })
    render(<ReceiptViewer loadReceipt={loadReceipt} title="Comprobante recuperado" />)
    fireEvent.click(await screen.findByRole('button', { name: /reintentar/i }))
    await waitFor(() => expect(loadReceipt).toHaveBeenCalledTimes(2))
    expect(await screen.findByTitle('Comprobante recuperado')).toBeInTheDocument()
  })
})
