// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'
import { createSupabaseServer } from '@/lib/supabase/server' 

const PUBLIC_ROUTES = ['/', '/signin', '/signup', '/auth/callback']

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context
  const pathname = url.pathname

  // Crée le client avec les cookies actuels
  const supabase = createSupabaseServer({
    cookies: context.cookies,
    request: context.request,
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  const isAuthenticated = !!user && !error
  const isPublic = PUBLIC_ROUTES.some(route =>
    pathname.startsWith(route)
  )

  if (!isPublic && !isAuthenticated) {
    return context.redirect('/signin')
  }

  if (pathname.startsWith('/signin') && isAuthenticated) {
    return context.redirect('/dashboard')
  }

  context.locals.user = user ?? null

  return next()
})