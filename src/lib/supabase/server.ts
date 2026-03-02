import { createServerClient } from '@supabase/ssr'
import type { AstroCookies } from 'astro'
import type { Database } from '@/lib/supabase/database.types'

export function createSupabaseServer(context: {
  request: Request
  cookies: AstroCookies
}) {
  const isProd = import.meta.env.PROD

  return createServerClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return context.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          context.cookies.set(name, value, {
            path: '/',
            httpOnly: true,
            secure: isProd,
            sameSite: 'lax',
            ...options,
          })
        },
        remove(name: string, options) {
          context.cookies.delete(name, {
            path: '/',
            ...options,
          })
        },
      },
    }
  )
}