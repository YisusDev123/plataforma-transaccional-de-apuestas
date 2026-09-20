import { PublicLayout } from '../shared/layouts/PublicLayout.jsx'
import { PageState } from '../shared/components/PageState.jsx'

export function NotFoundPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-7 sm:py-24">
        <p className="mb-4 text-center text-7xl font-black text-electric-400/35">404</p>
        <PageState variant="error" title="Esta página no existe" actionLabel="Ir al inicio">
          Revisa la dirección o vuelve al inicio para continuar navegando.
        </PageState>
      </div>
    </PublicLayout>
  )
}
