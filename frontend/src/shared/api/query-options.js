export function shouldRetryQuery(failureCount, error) {
  return error?.status !== 429 && failureCount < 1
}
