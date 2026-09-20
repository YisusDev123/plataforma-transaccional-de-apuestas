import { useState } from 'react'
import { Button } from './Button.jsx'
import { FormField } from './FormField.jsx'
import { SelectField } from './SelectField.jsx'

export function HistoryFilters({ initialSearch = '', onApply, searchLabel = 'Identificador de solicitud', searchName = 'requestId', searchPlaceholder = 'Buscar por requestId', status = '', statusOptions }) {
  const [values, setValues] = useState({ search: initialSearch, status })

  const submit = (event) => {
    event.preventDefault()
    onApply({ [searchName]: values.search.trim(), status: values.status })
  }

  return (
    <form className="surface-soft grid gap-4 rounded-2xl p-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={submit}>
      <SelectField label="Estado" options={[{ value: '', label: 'Todos los estados' }, ...statusOptions]} value={values.status} onChange={(event) => setValues((current) => ({ ...current, status: event.target.value }))} />
      <FormField label={searchLabel} placeholder={searchPlaceholder} value={values.search} onChange={(event) => setValues((current) => ({ ...current, search: event.target.value }))} />
      <Button type="submit">Aplicar filtros</Button>
    </form>
  )
}
