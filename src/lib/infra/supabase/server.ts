// src/lib/infra/supabase/server.ts
// ⚠️  Garder sameSite: 'none' sur set — requis pour auth Supabase en prod Vercel
import { createServerClient } from '@supabase/ssr'
import type { AstroCookies } from 'astro'
import type { Database } from '@/lib/infra/supabase/database.types'

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
            path:     '/',
            httpOnly: true,
            secure:   true,
            sameSite: 'none',
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