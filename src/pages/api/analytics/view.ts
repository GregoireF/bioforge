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

// ── Validation ───────────────────────────────────────────────
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

  // 2. Origin guard (prod uniquement)
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  if (import.meta.env.PROD && !origin.includes('bioforge.click'))
    return new Response(null, { status: 403 })

  // 3. Parse body
  let body: unknown
  try { body = await request.json() } catch {
    return new Response(null, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })
  const d = parsed.data

  // 4. User-Agent
  const ua = request.headers.get('user-agent') || ''

  // 5. Bot detection — log les bots nommés, skip les generiques
  const { isBot, botName } = detectBot(ua)
  if (isBot) {
    // On logge les crawlers nommés (SEO, LLMs) pour info mais on n'incrémente pas les views
    if (botName) {
      await supabase.from('profile_views').insert({
        profile_id:  d.profile_id,
        device_type: 'bot',
        browser:     botName,
        os:          null,
        country:     null,
        city:        null,
        ip_hash:     null, // pas de hash pour les bots
        is_vpn:      false,
        is_hosting:  true,
      }).then(() => {}) // fire-and-forget, pas d'await bloquant
    }
    return new Response(JSON.stringify({ ok: true, skipped: 'bot', name: botName }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 6. IP + hash
  const ip     = getIP(request)
  const ipHash = hashIP(ip)

  // 7. Déduplication ip_hash + profile_id sur les dernières 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('profile_views')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', d.profile_id)
    .eq('ip_hash', ipHash)
    .neq('device_type', 'bot')   // exclure les bots du comptage
    .gte('viewed_at', since24h)

  if ((count ?? 0) > 0) {
    return new Response(JSON.stringify({ ok: true, skipped: 'dedup_24h' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 8. UA parsing (browser, os, device_type, inferredReferrer)
  const { browser, os, device_type, inferredReferrer } = parseUA(ua)

  // 9. GeoIP via ip-api.com (timeout 2s, silencieux si erreur)
  const { country, city, is_vpn, is_hosting } = await resolveGeoIP(ip)

  // 10. Referrer — priorité : referrer HTTP explicite > in-app browser inféré
  const { domain: referrerDomain, fullUrl: referrerFull } = cleanReferrer(d.referrer)
  const referrer = referrerDomain || inferredReferrer

  // 11. Insert raw event
  const { error: insertError } = await supabase.from('profile_views').insert({
    profile_id:    d.profile_id,
    ip_hash:       ipHash,
    country,
    city,
    is_vpn,
    is_hosting,
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
  })

  if (insertError) {
    console.error('[analytics/view] insert:', insertError.message)
    return new Response(JSON.stringify({ ok: false }), { status: 200 })
  }

  // 12. Incrément compteur journalier (upsert atomique RPC)
  const today = new Date().toISOString().split('T')[0]
  await supabase.rpc('increment_profile_views', {
    p_profile_id: d.profile_id,
    p_date:       today,
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}