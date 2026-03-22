export function getCorrelationId(request: Request): string {
  return (
    request.headers.get('x-correlation-id') ??
    globalThis.crypto.randomUUID()  // Web Crypto — compatible Edge + Node + browser
  )
}