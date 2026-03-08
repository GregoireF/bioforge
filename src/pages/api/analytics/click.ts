// src/pages/api/analytics/click.ts
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
  block_id:     z.string().uuid(),
  referrer:     z.string().max(500).nullable().optional(),
  utm_source:   z.string().max(100).nullable().optional(),
  utm_medium:   z.string().max(100).nullable().optional(),
  utm_campaign: z.string().max(100).nullable().optional(),
})

export const POST: APIRoute = async ({ request }) => {
  // 1. Content-type
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  // 2. Protection : profile_id/block_id UUID valide + SUPABASE_SERVICE_ROLE_KEY côté serveur.
  //    Pas de origin guard — les navigateurs n'envoient pas l'header Origin
  //    sur les requêtes same-origin fetch, ce qui bloquerait toutes les requêtes légitimes.

  // 3. Parse + validate
  let body: unknown
  try { body = await request.json() } catch {
    return new Response(null, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    console.warn('[analytics/click] validation failed:', parsed.error.flatten())
    return new Response(null, { status: 400 })
  }
  const d = parsed.data

  // 4. Bot check
  const ua = request.headers.get('user-agent') || ''
  const { isBot, botName } = detectBot(ua)
  if (isBot) {
    return new Response(JSON.stringify({ ok: true, skipped: 'bot', name: botName }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 5. Résoudre profile_id depuis block_id
  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('profile_id')
    .eq('id', d.block_id)
    .is('deleted_at', null)
    .single()

  if (blockError || !block) {
    console.error('[analytics/click] block not found:', d.block_id, blockError?.message)
    return new Response(JSON.stringify({ ok: false }), { status: 200 })
  }

  // 6. IP + hash + UA
  const ip     = getIP(request)
  const ipHash = hashIP(ip)
  const { browser, os, device_type, inferredReferrer } = parseUA(ua)
  const { domain: referrerDomain } = cleanReferrer(d.referrer)
  const referrer = referrerDomain || inferredReferrer

  // 7. ⚡ RPC d'abord — incrément compteur journalier (chemin critique)
  const today = new Date().toISOString().split('T')[0]
  const { error: rpcError } = await supabase.rpc('increment_block_clicks', {
    p_block_id: d.block_id,
    p_date:     today,
  })
  if (rpcError) console.error('[analytics/click] rpc error:', rpcError.message)

  // 8. GeoIP + insert raw click (fire-and-forget, non-bloquant)
  resolveGeoIP(ip).then(({ country, city, is_vpn, is_hosting }) => {
    const payload: Record<string, unknown> = {
      block_id:    d.block_id,
      profile_id:  block.profile_id,
      ip_hash:     ipHash,
      country,
      city,
      device_type,
      os,
      browser,
      referrer,
      utm_source:   cleanUtm(d.utm_source),
      utm_medium:   cleanUtm(d.utm_medium),
      utm_campaign: cleanUtm(d.utm_campaign),
      is_vpn,
      is_hosting,
    }
    supabase.from('block_clicks').insert(payload)
      .then(({ error }) => {
        if (error) {
          const { is_vpn: _v, is_hosting: _h, ...fallback } = payload
          supabase.from('block_clicks').insert(fallback)
            .then(({ error: e2 }) => {
              if (e2) console.error('[analytics/click] insert fallback error:', e2.message)
            })
        }
      })
  }).catch(() => {
    supabase.from('block_clicks').insert({
      block_id:    d.block_id,
      profile_id:  block.profile_id,
      ip_hash:     ipHash,
      device_type,
      os,
      browser,
      referrer,
      utm_source:   cleanUtm(d.utm_source),
      utm_medium:   cleanUtm(d.utm_medium),
      utm_campaign: cleanUtm(d.utm_campaign),
    }).then(() => {})
  })

  // 9. Réponse immédiate
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}