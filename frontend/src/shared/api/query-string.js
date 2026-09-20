export function queryString(values) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value != null) params.set(key, String(value))
  })
  const value = params.toString()
  return value ? `?${value}` : ''
}
