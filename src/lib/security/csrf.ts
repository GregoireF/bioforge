const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])

export function verifyCSRF(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true

  const origin = request.headers.get('origin')
  if (!origin) return false

  return origin === import.meta.env.PUBLIC_SITE_URL
}