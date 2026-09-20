import { PublicLayout } from '../shared/layouts/PublicLayout.jsx'
import { PageState } from '../shared/components/PageState.jsx'

export function PendingPage({ description, title }) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-7 sm:py-24">
        <PageState actionLabel="Volver al inicio" title={title}>
          {description}
        </PageState>
      </div>
    </PublicLayout>
  )
}
