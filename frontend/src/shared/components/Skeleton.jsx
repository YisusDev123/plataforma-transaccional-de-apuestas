export function Skeleton({ className = '' }) {
  return <span className={`animate-soft-pulse block rounded-xl bg-white/[0.09] ${className}`} aria-hidden="true" />
}

export function CardSkeleton() {
  return (
    <div className="surface-soft rounded-2xl p-5" aria-label="Cargando contenido" role="status">
      <span className="sr-only">Cargando contenido</span>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-40" />
      <Skeleton className="mt-3 h-3 w-full" />
    </div>
  )
}
