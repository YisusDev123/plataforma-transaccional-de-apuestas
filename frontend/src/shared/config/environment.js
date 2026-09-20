function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:2000'

export const environment = Object.freeze({
  apiBaseUrl: withoutTrailingSlash(configuredApiUrl),
  appTarget: import.meta.env.VITE_APP_TARGET || 'web',
})
