const accessTokens = new Map()
const invalidationListeners = new Map()

export function getAccessToken(scope = 'user') {
  return accessTokens.get(scope) || null
}

export function setAccessToken(token, scope = 'user') {
  if (!token) {
    accessTokens.delete(scope)
    return
  }
  accessTokens.set(scope, token)
}

export function clearAccessToken(scope = 'user') {
  accessTokens.delete(scope)
}

export function clearAllAccessTokens() {
  accessTokens.clear()
}

export function invalidateAccessToken(scope = 'user') {
  accessTokens.delete(scope)
  invalidationListeners.get(scope)?.forEach((listener) => listener())
}

export function subscribeToSessionInvalidation(listener, scope = 'user') {
  const listeners = invalidationListeners.get(scope) || new Set()
  listeners.add(listener)
  invalidationListeners.set(scope, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) invalidationListeners.delete(scope)
  }
}
