import { supabaseAdmin } from '@/lib/infra/supabase/admin'

export interface RateLimitConfig {
  max:           number
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  key:     string
}

export const RATE_LIMITS = {
  'analytics_view':  { max: 30, windowSeconds: 60   },
  'analytics_click': { max: 60, windowSeconds: 60   },
  'gdpr_export':     { max: 5,  windowSeconds: 3600 },
  'gdpr_delete':     { max: 2,  windowSeconds: 3600 },
  'gdpr_consent':    { max: 20, windowSeconds: 60   },
  'auth_login':      { max: 10, windowSeconds: 300  },
  'auth_signup':     { max: 5,  windowSeconds: 3600 },
} as const

export type RateLimitRoute = keyof typeof RATE_LIMITS

export async function checkRateLimit(
  route:   RateLimitRoute,
  ipHash:  string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const cfg = config ?? RATE_LIMITS[route]
  const key = `${route}:${ipHash}`

  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key:    key,
      p_max:    cfg.max,
      p_window: `${cfg.windowSeconds} seconds`,
    })

    if (error) {
      console.error('[rate-limit] rpc error:', error.message)
      return { allowed: true, key }   // fail-open
    }

    return { allowed: Boolean(data), key }
  } catch (err) {
    console.error('[rate-limit] unexpected error:', err)
    return { allowed: true, key }     // fail-open
  }
}

export function rateLimitedResponse(windowSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: 'too_many_requests', retry_after: windowSeconds }),
    {
      status: 429,
      headers: {
        'Content-Type':      'application/json',
        'Retry-After':       String(windowSeconds),
        'X-RateLimit-Limit': 'exceeded',
      },
    }
  )
}