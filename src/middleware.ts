// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'
import { createSupabaseServer } from '@/lib/infra/supabase/server'

const PUBLIC_ROUTES = ['/', '/signin', '/signup', '/auth/callback']

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context
  const pathname = url.pathname

  if (pathname.startsWith('/api/')) return next()
  if (pathname.startsWith('/@')) return next()

  const supabase = createSupabaseServer({
    cookies: context.cookies,
    request: context.request,
  })

  // ⚠️  getSession() au lieu de getUser() pour le middleware
  // getUser() fait un appel réseau Supabase Auth — peut retourner null
  // si l'edge function Vercel ne reçoit pas les cookies correctement.
  // getSession() lit uniquement le JWT depuis le cookie — pas d'appel réseau.
  // La validation cryptographique du token se fait dans wrapApiHandler via getUser().
  const { data: { session } } = await supabase.auth.getSession()
  const isAuthenticated = !!session?.user

  context.locals.user     = session?.user ?? null
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