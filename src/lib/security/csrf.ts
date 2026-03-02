import { parse } from 'cookie'

const SITE_URL = import.meta.env.PUBLIC_SITE_URL

export function verifyCSRF(request: Request) {
  if (import.meta.env.DEV) {
    return true
  }

  const cookies = parse(request.headers.get('cookie') ?? '')
  const csrfCookie = cookies['csrf_token']
  const csrfHeader = request.headers.get('x-csrf-token')
  const fetchSite = request.headers.get('sec-fetch-site')
  const origin = request.headers.get('origin')

  if (fetchSite === 'cross-site') return false
  if (!csrfCookie || !csrfHeader) return false
  if (csrfCookie !== csrfHeader) return false
  if (!origin || origin !== SITE_URL) return false

  return true
}