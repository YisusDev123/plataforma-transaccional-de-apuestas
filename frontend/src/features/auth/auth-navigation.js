export function safePlayerReturnTo(value) {
  return value?.startsWith('/app') && !value.startsWith('//') ? value : '/app'
}
