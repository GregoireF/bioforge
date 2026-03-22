// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'
import { createSupabaseServer } from '@/lib/infra/supabase/server'  // ✅ nouveau chemin

// Routes accessibles sans authentification
const PUBLIC_ROUTES = new Set(['/', '/signin', '/signup'])

// Préfixes publics — routes qui commencent par ces segments
const PUBLIC_PREFIXES = [
  '/auth/',        // auth/callback, auth/confirm…
  '/api/analytics/', // click + view — publics (visiteurs)
  '/api/rgpd/consent', // consentement sans auth
  '/@',            // pages publiques profil /@username
]

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // ─── Routes API — pas de redirect, juste passer (auth gérée par wrapApiHandler)
  if (pathname.startsWith('/api/')) {
    const isPublicApi = PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
    if (isPublicApi) return next()
    // Les autres routes API gèrent leur propre auth via wrapApiHandler
    return next()
  }

  // ─── Auth check pour les pages SSR
  const supabase = createSupabaseServer({
    cookies: context.cookies,
    request: context.request,
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  const isAuthenticated = !!user && !error

  // Stocker dans locals — typé via env.d.ts
  context.locals.user       = user ?? null
  context.locals.supabase   = supabase

  // ─── Logique de redirection
  const isPublic =
    PUBLIC_ROUTES.has(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  if (!isPublic && !isAuthenticated) {
    // Préserver l'URL de destination pour redirect post-login
    const redirectUrl = encodeURIComponent(pathname)
    return context.redirect(`/signin?redirect=${redirectUrl}`)
  }

  if ((pathname === '/signin' || pathname === '/signup') && isAuthenticated) {
    return context.redirect('/dashboard')
  }

  return next()
})