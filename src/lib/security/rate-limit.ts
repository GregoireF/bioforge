import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

export interface RateLimitConfig {
  max:            number   // requêtes max dans la fenêtre
  windowSeconds:  number   // durée de la fenêtre en secondes
}

export interface RateLimitResult {
  allowed:  boolean
  key:      string
}

// Configs par route — ajustées au risque de chaque endpoint
export const RATE_LIMITS = {
  // Analytics : 1 vue par IP toutes les 2s (le dedup 24h est côté view.ts)
  'analytics_view':  { max: 30,  windowSeconds: 60  },
  'analytics_click': { max: 60,  windowSeconds: 60  },

  // RGPD : 5 exports / 2 deletes par heure max
  'gdpr_export':     { max: 5,   windowSeconds: 3600 },
  'gdpr_delete':     { max: 2,   windowSeconds: 3600 },
  'gdpr_consent':    { max: 20,  windowSeconds: 60   },

  // Auth (en complément du rate limit Supabase Auth natif)
  'auth_login':      { max: 10,  windowSeconds: 300  },
  'auth_signup':     { max: 5,   windowSeconds: 3600 },
} as const

export type RateLimitRoute = keyof typeof RATE_LIMITS

/**
 * Vérifie et incrémente le compteur de rate limit.
 * @param route   Identifiant de la route (clé de RATE_LIMITS)
 * @param ipHash  Hash de l'IP (16 chars) — jamais l'IP brute
 * @param config  Optionnel : override la config par défaut
 */
export async function checkRateLimit(
  route:   RateLimitRoute,
  ipHash:  string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const cfg = config ?? RATE_LIMITS[route]
  const key = `${route}:${ipHash}`

  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key:    key,
      p_max:    cfg.max,
      p_window: `${cfg.windowSeconds} seconds`,
    })

    if (error) {
      // En cas d'erreur DB, on laisse passer pour ne pas bloquer les users légitimes
      console.error('[rate-limit] rpc error:', error.message)
      return { allowed: true, key }
    }

    return { allowed: Boolean(data), key }
  } catch (err) {
    console.error('[rate-limit] unexpected error:', err)
    return { allowed: true, key }
  }
}

/**
 * Retourne une Response 429 standard avec headers Retry-After.
 */
export function rateLimitedResponse(windowSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: 'too_many_requests', retry_after: windowSeconds }),
    {
      status: 429,
      headers: {
        'Content-Type':  'application/json',
        'Retry-After':   String(windowSeconds),
        'X-RateLimit-Limit': 'exceeded',
      },
    }
  )
}