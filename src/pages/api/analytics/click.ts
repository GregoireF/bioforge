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

// ── Validation ───────────────────────────────────────────────
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

  // 2. Origin guard
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

  // 4. Bot check — les bots ne génèrent pas de clicks réels
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

  if (blockError || !block)
    return new Response(JSON.stringify({ ok: false }), { status: 200 })

  // 6. IP + hash
  const ip     = getIP(request)
  const ipHash = hashIP(ip)

  // 7. UA
  const { browser, os, device_type, inferredReferrer } = parseUA(ua)

  // 8. GeoIP (timeout 2s, silencieux si erreur)
  const { country, city, is_vpn, is_hosting } = await resolveGeoIP(ip)

  // 9. Referrer
  const { domain: referrerDomain } = cleanReferrer(d.referrer)
  const referrer = referrerDomain || inferredReferrer

  // 10. Insert raw click
  const { error: insertError } = await supabase.from('block_clicks').insert({
    block_id:    d.block_id,
    profile_id:  block.profile_id,
    ip_hash:     ipHash,
    country,
    city,
    is_vpn,
    is_hosting,
    device_type,
    os,
    browser,
    referrer,
    utm_source:   cleanUtm(d.utm_source),
    utm_medium:   cleanUtm(d.utm_medium),
    utm_campaign: cleanUtm(d.utm_campaign),
  })

  if (insertError) {
    console.error('[analytics/click] insert:', insertError.message)
    return new Response(JSON.stringify({ ok: false }), { status: 200 })
  }

  // 11. Incrément compteur journalier
  const today = new Date().toISOString().split('T')[0]
  await supabase.rpc('increment_block_clicks', {
    p_block_id: d.block_id,
    p_date:     today,
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}