// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'
import { createSupabaseServer } from '@/lib/supabase/server'  // ← chemin original

const PUBLIC_ROUTES = ['/', '/signin', '/signup', '/auth/callback']

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context
  const pathname = url.pathname

  // Routes API — auth gérée par wrapApiHandler
  if (pathname.startsWith('/api/')) return next()

  // Pages profil publiques
  if (pathname.startsWith('/@')) return next()

  const supabase = createSupabaseServer({
    cookies: context.cookies,
    request: context.request,
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  const isAuthenticated = !!user && !error

  // Peuple locals — user + supabase pour les pages SSR
  context.locals.user     = user ?? null
  context.locals.supabase = supabase

  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  if (!isPublic && !isAuthenticated) {
    return context.redirect('/signin')
  }

  if (pathname.startsWith('/signin') && isAuthenticated) {
    return context.redirect('/dashboard')
  }

  return next()
})