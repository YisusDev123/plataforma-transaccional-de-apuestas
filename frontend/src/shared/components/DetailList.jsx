export function DetailList({ items }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
      {items.map((item) => (
        <div className="bg-night-900/90 p-4" key={item.label}>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">{item.label}</dt>
          <dd className="mt-2 break-words text-sm font-semibold text-white">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
