export function DataTable({ caption, columns, rows }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-white/[0.045] text-xs uppercase tracking-wider text-[#9fa6c3]">
          <tr>{columns.map((column) => <th className="px-5 py-4 font-bold" key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/[0.07]">
          {rows.map((row) => (
            <tr className="bg-night-900/45 text-[#e7e9f5] hover:bg-white/[0.035]" key={row.id}>
              {columns.map((column) => <td className="px-5 py-4" key={column.key}>{row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
