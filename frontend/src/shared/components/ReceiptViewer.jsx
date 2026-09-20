import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, LoaderCircle } from 'lucide-react'
import { QueryErrorState } from './QueryState.jsx'

export function ReceiptViewer({ loadReceipt, title }) {
  const [state, setState] = useState({ status: 'loading', url: '', filename: '', error: null })
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(null)

  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (requestRef.current?.attempt !== attempt || requestRef.current?.loadReceipt !== loadReceipt) {
      requestRef.current = { attempt, loadReceipt, promise: loadReceipt() }
    }
    requestRef.current.promise.then(({ blob, filename }) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setState({ status: 'success', url: objectUrl, filename, error: null })
    }).catch((error) => {
      if (active) setState({ status: 'error', url: '', filename: '', error })
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attempt, loadReceipt])

  if (state.status === 'loading') return <div className="surface-panel grid min-h-80 place-items-center rounded-3xl" role="status"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-electric-400" size={28} aria-hidden="true" /><p className="mt-3 text-sm text-muted">Preparando comprobante…</p></div></div>
  if (state.status === 'error') return <QueryErrorState error={state.error} onRetry={() => { setState({ status: 'loading', url: '', filename: '', error: null }); setAttempt((current) => current + 1) }} />

  return <section className="grid gap-4">
    <div className="flex flex-wrap gap-3">
      <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-electric-500 px-4 py-2.5 text-sm font-bold text-white" href={state.url} target="_blank" rel="noreferrer"><ExternalLink size={17} aria-hidden="true" /> Abrir PDF</a>
      <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-4 py-2.5 text-sm font-bold text-white" href={state.url} download={state.filename}><Download size={17} aria-hidden="true" /> Descargar</a>
    </div>
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
      <iframe className="h-[72vh] min-h-[34rem] w-full" src={state.url} title={title} />
    </div>
  </section>
}
