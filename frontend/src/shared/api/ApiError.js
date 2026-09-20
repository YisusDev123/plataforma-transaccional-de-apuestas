export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details = null, correlationId = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.correlationId = correlationId
  }
}
