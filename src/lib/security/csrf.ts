import { parse } from 'cookie'

const SITE_URL = import.meta.env.PUBLIC_SITE_URL

export function verifyCSRF(request: Request) {
  if (import.meta.env.DEV) return true

  const url = new URL(request.url)

  // OAuth callback autorisé
  if (url.pathname.startsWith('/auth/callback')) return true

  // CSRF uniquement pour requêtes sensibles
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return true
  }

  const cookies = parse(request.headers.get('cookie') ?? '')
  const csrfCookie = cookies['csrf_token']
  const csrfHeader = request.headers.get('x-csrf-token')
  const origin = request.headers.get('origin')

  if (!csrfCookie || !csrfHeader) return false
  if (csrfCookie !== csrfHeader) return false
  if (!origin || origin !== SITE_URL) return false

  return true
}