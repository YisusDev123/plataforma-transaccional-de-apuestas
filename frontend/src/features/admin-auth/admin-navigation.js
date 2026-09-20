export function safeAdminReturnTo(value) {
  return value?.startsWith('/admin') && !value.startsWith('//') && value !== '/admin/login' ? value : '/admin'
}
