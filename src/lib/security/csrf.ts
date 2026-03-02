import { parse } from 'cookie'

const SITE_URL = import.meta.env.PUBLIC_SITE_URL

export function verifyCSRF(request: Request) {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) {
    return true;
  }

  const origin = request.headers.get('origin');
  if (!origin) return false;

  return origin === import.meta.env.PUBLIC_SITE_URL;
}