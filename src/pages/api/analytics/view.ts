// src/pages/api/analytics/view.ts
// POST — enregistre une vue de profil (public, sans auth)
import type { APIRoute }  from 'astro'
import { supabaseAdmin }  from '@/lib/infra/supabase/admin'
import { z }              from 'zod'
import {
  getIP, hashIP, detectBot, parseUA,
  resolveGeoIP, cleanReferrer, cleanUtm,
} from '@/lib/analytics/helpers'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rate-limit'
import { json }           from '@/lib/core/http'

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
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  let body: unknown
  try { body = await request.json() }
  catch { return new Response(null, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })

  const d  = parsed.data
  const ua = request.headers.get('user-agent') ?? ''

  // Bot check — log les bots nommés sans incrémenter les compteurs
  const { isBot, botName } = detectBot(ua)
  if (isBot) {
    if (botName) {
      // Fire-and-forget acceptable ici — pas de compteur critique
      supabaseAdmin.from('profile_views').insert({
        profile_id:  d.profile_id,
        device_type: 'bot',
        browser:     botName,
        is_hosting:  true,
      }).then(() => {})
    }
    return json({ ok: true, skipped: 'bot' })
  }

  // IP + hash + rate limit
  const ip     = getIP(request)
  const ipHash = await hashIP(ip)  // ✅ async

  const { allowed } = await checkRateLimit('analytics_view', ipHash)
  if (!allowed) return rateLimitedResponse(60)

  // Déduplication 24h (ip_hash + profile_id)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabaseAdmin
    .from('profile_views')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', d.profile_id)
    .eq('ip_hash', ipHash)
    .neq('device_type', 'bot')
    .gte('viewed_at', since24h)

  if (!countError && (count ?? 0) > 0)
    return json({ ok: true, skipped: 'dedup_24h' })

  // RPC compteur journalier (chemin critique — avant GeoIP)
  const today = new Date().toISOString().split('T')[0]
  const { error: rpcError } = await supabaseAdmin.rpc('increment_profile_views', {
    p_profile_id: d.profile_id,
    p_date:       today,
  })
  if (rpcError) console.error('[analytics/view] rpc error:', rpcError.message)

  const { browser, os, device_type, inferredReferrer } = parseUA(ua)
  const { domain: referrerDomain, fullUrl: referrerFull } = cleanReferrer(d.referrer)
  const referrer = referrerDomain || inferredReferrer

  const { country, city, is_vpn, is_hosting } = await resolveGeoIP(ip)

  const payload = {
    profile_id:    d.profile_id,
    ip_hash:       ipHash,
    device_type,   os, browser, referrer,
    referrer_full: referrerFull,
    utm_source:    cleanUtm(d.utm_source),
    utm_medium:    cleanUtm(d.utm_medium),
    utm_campaign:  cleanUtm(d.utm_campaign),
    utm_content:   cleanUtm(d.utm_content),
    utm_term:      cleanUtm(d.utm_term),
  }

  const { error: insertError } = await supabaseAdmin.from('profile_views').insert({
    ...payload, country, city, is_vpn, is_hosting,
  })

  if (insertError) {
    console.warn('[analytics/view] insert failed, fallback:', insertError.message)
    const { error: e2 } = await supabaseAdmin.from('profile_views').insert({ ...payload, country, city })
    if (e2) console.error('[analytics/view] fallback error:', e2.message)
  }

  return json({ ok: true })
}