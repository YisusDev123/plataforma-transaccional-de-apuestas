import { useEffect, useId, useRef } from 'react'
import { Button } from './Button.jsx'

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
const fieldSelector = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'

export function ConfirmDialog({ children, confirmLabel = 'Confirmar', confirmLoading = false, onClose, onConfirm, open, title }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const confirmLoadingRef = useRef(confirmLoading)

  const keepFocusInside = (event) => {
    if (event.key !== 'Tab') return
    const focusable = [...(dialogRef.current?.querySelectorAll(focusableSelector) || [])]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { confirmLoadingRef.current = confirmLoading }, [confirmLoading])

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const firstField = dialogRef.current?.querySelector(fieldSelector)
    ;(firstField || confirmRef.current || cancelRef.current)?.focus()
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !confirmLoadingRef.current) onCloseRef.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !confirmLoading && onClose()}>
      <section ref={dialogRef} className="surface-panel w-full max-w-md rounded-3xl p-6" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keepFocusInside}>
        <h2 className="text-xl font-black text-white" id={titleId}>{title}</h2>
        <div className="mt-3 text-sm leading-6 text-muted">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" disabled={confirmLoading} onClick={onClose}>Cancelar</Button>
          <Button ref={confirmRef} loading={confirmLoading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </section>
    </div>
  )
}
