import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button.jsx'

export function Pagination({ currentPage, onPageChange, totalPages }) {
  const safeTotal = Math.max(1, totalPages)
  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
      <Button variant="secondary" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Página anterior">
        <ChevronLeft size={17} aria-hidden="true" />
        <span className="hidden sm:inline">Anterior</span>
      </Button>
      <p className="text-sm font-semibold text-muted">
        Página <span className="text-white">{currentPage}</span> de <span className="text-white">{safeTotal}</span>
      </p>
      <Button variant="secondary" disabled={currentPage >= safeTotal} onClick={() => onPageChange(currentPage + 1)} aria-label="Página siguiente">
        <span className="hidden sm:inline">Siguiente</span>
        <ChevronRight size={17} aria-hidden="true" />
      </Button>
    </nav>
  )
}
