// src/pages/api/analytics/view.ts
import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  getIP, hashIP,
  detectBot, parseUA,
  resolveGeoIP, cleanReferrer, cleanUtm,
} from '@/lib/analytics/helpers'

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

const schema = z.object({
  profile_id:   z.string().uuid(),
  referrer:     z.string().max(500).nullable().optional(),
  utm_source:   z.string().max(100).nullable().optional(),
  utm_medium:   z.string().max(100).nullable().optional(),
  utm_campaign: z.string().max(100).nullable().optional(),
  utm_content:  z.string().max(100).nullable().optional(),
  utm_term:     z.string().max(100).nullable().optional(),
})

export const POST: APIRoute = async ({ request }) => {
  // 1. Content-type
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  // 2. Protection : profile_id/block_id UUID valide + SUPABASE_SERVICE_ROLE_KEY côté serveur.
  //    Pas de origin guard — les navigateurs n'envoient pas l'header Origin
  //    sur les requêtes same-origin fetch, ce qui bloquerait toutes les requêtes légitimes.

  // 3. Parse + validate body
  let body: unknown
  try { body = await request.json() } catch {
    return new Response(null, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    console.warn('[analytics/view] validation failed:', parsed.error.flatten())
    return new Response(null, { status: 400 })
  }
  const d = parsed.data

  // 4. User-Agent + bot detection
  const ua = request.headers.get('user-agent') || ''
  const { isBot, botName } = detectBot(ua)

  if (isBot) {
    // Log les bots nommés (SEO, LLMs) sans incrémenter les compteurs
    if (botName) {
      supabase.from('profile_views').insert({
        profile_id:  d.profile_id,
        device_type: 'bot',
        browser:     botName,
        is_hosting:  true,
      }).then(() => {})
    }
    return new Response(JSON.stringify({ ok: true, skipped: 'bot' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 5. IP + hash
  const ip     = getIP(request)
  const ipHash = hashIP(ip)

  // 6. Déduplication 24h côté serveur (ip_hash + profile_id)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabase
    .from('profile_views')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', d.profile_id)
    .eq('ip_hash', ipHash)
    .neq('device_type', 'bot')
    .gte('viewed_at', since24h)

  if (countError) {
    console.error('[analytics/view] dedup check error:', countError.message)
    // En cas d'erreur sur le check, on laisse passer pour ne pas perdre des vues
  } else if ((count ?? 0) > 0) {
    return new Response(JSON.stringify({ ok: true, skipped: 'dedup_24h' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 7. ⚡ RPC d'abord — incrément compteur journalier (chemin critique)
  //    On fait ça AVANT le GeoIP pour que le compteur soit à jour
  //    même si la suite échoue.
  const today = new Date().toISOString().split('T')[0]
  const { error: rpcError } = await supabase.rpc('increment_profile_views', {
    p_profile_id: d.profile_id,
    p_date:       today,
  })
  if (rpcError) console.error('[analytics/view] rpc error:', rpcError.message)

  // 8. UA parsing + GeoIP en parallèle (non-bloquant pour le compteur)
  const { browser, os, device_type, inferredReferrer } = parseUA(ua)
  const { domain: referrerDomain, fullUrl: referrerFull } = cleanReferrer(d.referrer)
  const referrer = referrerDomain || inferredReferrer

  // GeoIP fire-and-forget : on insère le raw event après,
  // sans bloquer la réponse HTTP sur le délai GeoIP
  resolveGeoIP(ip).then(({ country, city, is_vpn, is_hosting }) => {
    const payload: Record<string, unknown> = {
      profile_id:    d.profile_id,
      ip_hash:       ipHash,
      country,
      city,
      device_type,
      os,
      browser,
      referrer,
      referrer_full: referrerFull,
      utm_source:    cleanUtm(d.utm_source),
      utm_medium:    cleanUtm(d.utm_medium),
      utm_campaign:  cleanUtm(d.utm_campaign),
      utm_content:   cleanUtm(d.utm_content),
      utm_term:      cleanUtm(d.utm_term),
      is_vpn,
      is_hosting,
    }
    supabase.from('profile_views').insert(payload)
      .then(({ error }) => {
        if (error) {
          // Fallback sans is_vpn/is_hosting si colonnes absentes en DB
          const { is_vpn: _v, is_hosting: _h, ...fallback } = payload
          supabase.from('profile_views').insert(fallback)
            .then(({ error: e2 }) => {
              if (e2) console.error('[analytics/view] insert fallback error:', e2.message)
            })
        }
      })
  }).catch(() => {
    // GeoIP entièrement raté — on insère quand même le raw event sans géo
    supabase.from('profile_views').insert({
      profile_id:    d.profile_id,
      ip_hash:       ipHash,
      device_type,
      os,
      browser,
      referrer,
      referrer_full: referrerFull,
      utm_source:    cleanUtm(d.utm_source),
      utm_medium:    cleanUtm(d.utm_medium),
      utm_campaign:  cleanUtm(d.utm_campaign),
      utm_content:   cleanUtm(d.utm_content),
      utm_term:      cleanUtm(d.utm_term),
    }).then(() => {})
  })

  // 9. Réponse immédiate — pas d'attente sur GeoIP ni sur l'insert raw
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}