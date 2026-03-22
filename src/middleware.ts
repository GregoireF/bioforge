// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'
import { createSupabaseServer } from '@/lib/infra/supabase/server'

// Routes accessibles sans authentification
const PUBLIC_ROUTES = new Set(['/', '/signin', '/signup'])

// Préfixes publics
const PUBLIC_PREFIXES = [
  '/auth/',          // auth/callback, auth/confirm…
  '/api/',           // toutes les API gèrent leur propre auth via wrapApiHandler
  '/@',              // pages publiques profil /@username
]

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // ─── Routes API et préfixes publics — passe directement
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return next()
  }

  // ─── Crée le client Supabase et peuple locals
  const supabase = createSupabaseServer({
    cookies: context.cookies,
    request: context.request,
  })

  context.locals.supabase = supabase

  // ─── getSession() — lecture locale du cookie JWT, pas d'appel réseau
  // Note : getUser() fait un appel réseau vers Supabase Auth — trop lent pour
  // le middleware et source de redirect loops si le réseau est lent.
  // La validation JWT côté serveur (getUser) se fait dans wrapApiHandler.
  const { data: { session } } = await supabase.auth.getSession()
  const isAuthenticated = !!session?.user

  context.locals.user = session?.user ?? null

  // ─── Logique de redirection
  const isPublic = PUBLIC_ROUTES.has(pathname)

  if (!isPublic && !isAuthenticated) {
    const redirectUrl = encodeURIComponent(pathname)
    return context.redirect(`/signin?redirect=${redirectUrl}`)
  }

  if ((pathname === '/signin' || pathname === '/signup') && isAuthenticated) {
    return context.redirect('/dashboard')
  }

  return next()
})