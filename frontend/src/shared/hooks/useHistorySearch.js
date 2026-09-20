import { useSearchParams } from 'react-router-dom'

function positivePage(value) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function useHistorySearch({ searchKey = 'requestId' } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    page: positivePage(searchParams.get('page')),
    limit: 10,
    status: searchParams.get('status') || '',
    [searchKey]: searchParams.get(searchKey) || '',
  }
  const setFilters = (next) => {
    const params = new URLSearchParams()
    const merged = { ...filters, ...next }
    if (merged.page > 1) params.set('page', String(merged.page))
    if (merged.status) params.set('status', merged.status)
    if (merged[searchKey]) params.set(searchKey, merged[searchKey])
    setSearchParams(params)
  }
  return { filters, setFilters }
}
