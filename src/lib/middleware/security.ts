import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async ({ request, locals }, next) => {
  const response = await next()

  // Headers de sécurité modernes 2025-2026
  const headers = response.headers

  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // CSP très basique – à adapter selon tes besoins (surtout si tu utilises du inline script/style)
  if (!import.meta.env.DEV) {
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +     // à durcir si possible
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https://*.supabase.co https://images.unsplash.com; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
    )
  }

  // Anti-clickjacking + autres
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  return response
})