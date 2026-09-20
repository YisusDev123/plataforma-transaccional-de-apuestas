import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Filter, Trophy } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { Pagination } from '../../shared/components/Pagination.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { SelectField } from '../../shared/components/SelectField.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { formatDate, formatMoney } from '../../shared/utils/formatters.js'

const viewOptions = [{ value: 'TODAY', label: 'Sorteos del día' }, { value: 'HISTORY', label: 'Historial' }]
const lotteryOptions = [{ value: '', label: 'Todas las loterías' }, { value: 'NICA', label: 'NICA' }, { value: 'TICA', label: 'TICA' }]
const modalityOptions = [{ value: '', label: 'Todas las modalidades' }, { value: 'NORMAL', label: 'Normal' }, { value: 'MEGA_REVENTADO', label: 'Mega reventado' }]
const statusOptions = [{ value: '', label: 'Todos los estados' }, ...['PENDING', 'OPEN', 'CLOSED', 'RESULT_LOADED', 'PAID', 'CANCELLED'].map((value) => ({ value, label: value }))]

function groupDraws(draws) {
  const groups = new Map()
  const modalityOrder = { NORMAL: 0, MEGA_REVENTADO: 1 }
  draws.forEach((draw) => {
    if (!groups.has(draw.lottery)) groups.set(draw.lottery, [])
    groups.get(draw.lottery).push(draw)
  })
  return [...groups.entries()].map(([lottery, items]) => ({
    lottery,
    items: items.sort((left, right) => String(left.schedule_time).localeCompare(String(right.schedule_time)) || (modalityOrder[left.modality] ?? 99) - (modalityOrder[right.modality] ?? 99) || Number(left.draw_id) - Number(right.draw_id))
  }))
}

function NumberGrid({ draw }) {
  return <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">{draw.numbers.map((item) => {
    const sold = item.sold_amount !== '0.00'
    const winner = draw.winning_number === item.number
    return <div className={`rounded-xl border p-3 ${winner ? 'border-gold-400/60 bg-gold-400/10' : 'border-white/10 bg-white/[0.035]'}`} key={item.number}>
      <div className="flex items-center justify-between gap-2"><span className="text-lg font-black text-white">{item.number}</span>{winner && <Trophy className="text-gold-400" size={15} aria-label="Número ganador" />}</div>
      <p className={`mt-2 text-sm font-black ${sold ? 'text-jade-400' : 'text-[#7d849e]'}`}>{formatMoney(item.sold_amount)}</p>
      <p className="mt-1 text-[0.68rem] text-muted">{item.bet_count} {item.bet_count === 1 ? 'jugada' : 'jugadas'}</p>
    </div>
  })}</div>
}

function DrawCard({ draw, open, onToggle }) {
  const modalityLabel = draw.modality === 'MEGA_REVENTADO' ? 'Mega reventado' : 'Normal'
  return <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
    <button type="button" className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.04]" aria-expanded={open} onClick={onToggle}>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-black text-white">{formatDate(draw.draw_date)} · {String(draw.schedule_time).slice(0, 5)}</span><span className="rounded-md bg-white/[0.08] px-2 py-1 text-[0.68rem] font-black uppercase tracking-wider text-electric-300">{modalityLabel}</span><StatusBadge status={draw.status} /></div><p className="mt-1 text-xs text-muted">Sorteo #{draw.draw_id}{draw.winning_number ? ` · Ganador ${draw.winning_number}` : ' · Resultado pendiente'}</p></div>
      {open ? <ChevronDown className="shrink-0 text-electric-400" size={20} aria-hidden="true" /> : <ChevronRight className="shrink-0 text-muted" size={20} aria-hidden="true" />}
    </button>
    {open && <div className="border-t border-white/10 px-5 pb-5 pt-1"><NumberGrid draw={draw} /><dl className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3"><div><dt className="text-xs font-bold uppercase tracking-wider text-muted">Total vendido bruto</dt><dd className="mt-1 text-lg font-black text-white">{formatMoney(draw.total_sold)}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-muted">Total reembolsado</dt><dd className="mt-1 text-lg font-black text-white">{formatMoney(draw.total_refunded)}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-muted">Premios pagados</dt><dd className="mt-1 text-lg font-black text-jade-400">{formatMoney(draw.total_paid)}</dd></div></dl></div>}
  </article>
}

export function AdminDrawListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') || 'TODAY'
  const page = Number(searchParams.get('page')) || 1
  const filters = { view, page, limit: 10, date_from: searchParams.get('date_from') || '', date_to: searchParams.get('date_to') || '', lottery: searchParams.get('lottery') || '', modality: searchParams.get('modality') || '', status: searchParams.get('status') || '' }
  const [openDraws, setOpenDraws] = useState(new Set())
  const query = useQuery({ queryKey: adminKeys.drawList(filters), queryFn: () => adminApi.drawList(filters) })
  const groups = useMemo(() => groupDraws(query.data?.draws || []), [query.data?.draws])
  const updateFilters = (changes) => { setOpenDraws(new Set()); setSearchParams({ ...filters, ...changes, page: changes.page ?? 1 }) }
  const toggleDraw = (id) => setOpenDraws((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  return <AdminLayout><PageHeader eyebrow="Control de ventas" title="Lista" subtitle="Consulta las ventas por número y el resultado financiero de cada sorteo, sin modificar operaciones." /><section className="surface-panel mt-7 rounded-3xl p-5 sm:p-6"><div className="flex items-center gap-2 text-sm font-black text-white"><Filter size={17} className="text-electric-400" aria-hidden="true" /> Filtros de consulta</div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><SelectField label="Vista" value={view} options={viewOptions} onChange={(event) => updateFilters({ view: event.target.value })} /><div className="grid gap-2"><label className="text-sm font-bold text-[#e8eaf6]" htmlFor="list-date-from">Desde</label><input id="list-date-from" type="date" value={filters.date_from} onChange={(event) => updateFilters({ date_from: event.target.value })} className="min-h-12 rounded-xl border border-white/12 bg-night-950/65 px-4 text-base text-white focus:border-electric-400 focus:outline-none" /></div><div className="grid gap-2"><label className="text-sm font-bold text-[#e8eaf6]" htmlFor="list-date-to">Hasta</label><input id="list-date-to" type="date" value={filters.date_to} onChange={(event) => updateFilters({ date_to: event.target.value })} className="min-h-12 rounded-xl border border-white/12 bg-night-950/65 px-4 text-base text-white focus:border-electric-400 focus:outline-none" /></div><SelectField label="Lotería" value={filters.lottery} options={lotteryOptions} onChange={(event) => updateFilters({ lottery: event.target.value })} /><SelectField label="Modalidad" value={filters.modality} options={modalityOptions} onChange={(event) => updateFilters({ modality: event.target.value })} /><SelectField label="Estado" value={filters.status} options={statusOptions} onChange={(event) => updateFilters({ status: event.target.value })} /></div></section><section className="mt-7">{query.isPending ? <div className="grid gap-4"><CardSkeleton /><CardSkeleton /></div> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : groups.length === 0 ? <PageState title={view === 'TODAY' ? 'No hay sorteos para hoy' : 'No hay sorteos en el historial'}>Prueba con otro rango de fechas o ajusta los filtros.</PageState> : <div className="grid gap-7">{groups.map((group) => <section key={group.lottery}><h2 className="text-xl font-black text-white">{group.lottery}</h2><div className="mt-3 grid gap-3">{group.items.map((draw) => <DrawCard key={draw.draw_id} draw={draw} open={openDraws.has(draw.draw_id)} onToggle={() => toggleDraw(draw.draw_id)} />)}</div></section>)}</div>} {query.data?.pagination?.totalPages > 1 && <div className="mt-6"><Pagination currentPage={query.data.pagination.currentPage} totalPages={query.data.pagination.totalPages} onPageChange={(nextPage) => updateFilters({ page: nextPage })} /></div>}</section></AdminLayout>
}
