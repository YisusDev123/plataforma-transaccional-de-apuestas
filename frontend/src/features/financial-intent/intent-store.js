const STORAGE_PREFIX = 'lottery:financial-intent:'

function key(operation) {
  return `${STORAGE_PREFIX}${operation}`
}

async function fingerprint(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export function getPendingIntent(operation) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(operation)))
    if (!value?.requestId || !value?.payloadFingerprint || !value?.createdAt) return null
    return value
  } catch {
    return null
  }
}

export async function prepareIntent(operation, payload) {
  const payloadFingerprint = await fingerprint(payload)
  const existing = getPendingIntent(operation)
  if (existing) {
    if (existing.payloadFingerprint === payloadFingerprint) return existing
    const error = new Error('Existe una solicitud anterior sin resolver con datos diferentes.')
    error.code = 'PENDING_INTENT_PAYLOAD_MISMATCH'
    error.intent = existing
    throw error
  }
  const intent = {
    operation,
    requestId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payloadFingerprint,
  }
  sessionStorage.setItem(key(operation), JSON.stringify(intent))
  return intent
}

export function resolveIntent(operation, requestId) {
  const existing = getPendingIntent(operation)
  if (!existing || existing.requestId === requestId) sessionStorage.removeItem(key(operation))
}

export function abandonIntent(operation) {
  sessionStorage.removeItem(key(operation))
}

export function clearFinancialIntents() {
  Object.keys(sessionStorage)
    .filter((storageKey) => storageKey.startsWith(STORAGE_PREFIX))
    .forEach((storageKey) => sessionStorage.removeItem(storageKey))
}
