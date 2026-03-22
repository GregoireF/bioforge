// src/pages/api/analytics/click.ts
// POST — enregistre un clic sur un bloc (public, sans auth)
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
  block_id:     z.string().uuid(),
  referrer:     z.string().max(500).nullable().optional(),
  utm_source:   z.string().max(100).nullable().optional(),
  utm_medium:   z.string().max(100).nullable().optional(),
  utm_campaign: z.string().max(100).nullable().optional(),
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

  // Bot check — répondre ok sans enregistrer
  const { isBot, botName } = detectBot(ua)
  if (isBot) return json({ ok: true, skipped: 'bot', name: botName })

  // Résoudre profile_id depuis block_id
  const { data: block, error: blockError } = await supabaseAdmin
    .from('blocks')
    .select('profile_id')
    .eq('id', d.block_id)
    .is('deleted_at', null)
    .single()

  if (blockError || !block) return json({ ok: false })

  // IP + hash + rate limit
  const ip     = getIP(request)
  const ipHash = await hashIP(ip)  // ✅ async

  const { allowed } = await checkRateLimit('analytics_click', ipHash)
  if (!allowed) return rateLimitedResponse(60)

  const { browser, os, device_type, inferredReferrer } = parseUA(ua)
  const { domain: referrerDomain } = cleanReferrer(d.referrer)
  const referrer = referrerDomain || inferredReferrer

  // RPC compteur journalier (chemin critique — avant GeoIP)
  const today = new Date().toISOString().split('T')[0]
  const { error: rpcError } = await supabaseAdmin.rpc('increment_block_clicks', {
    p_block_id: d.block_id,
    p_date:     today,
  })
  if (rpcError) console.error('[analytics/click] rpc error:', rpcError.message)

  // GeoIP awaité — Vercel tue la fonction dès que Response retournée
  const { country, city, is_vpn, is_hosting } = await resolveGeoIP(ip)

  const payload = {
    block_id:    d.block_id,
    profile_id:  block.profile_id,
    ip_hash:     ipHash,
    device_type, os, browser, referrer,
    utm_source:   cleanUtm(d.utm_source),
    utm_medium:   cleanUtm(d.utm_medium),
    utm_campaign: cleanUtm(d.utm_campaign),
  }

  const { error: insertError } = await supabaseAdmin.from('block_clicks').insert({
    ...payload, country, city, is_vpn, is_hosting,
  })

  if (insertError) {
    console.warn('[analytics/click] insert failed, fallback:', insertError.message)
    const { error: e2 } = await supabaseAdmin.from('block_clicks').insert({ ...payload, country, city })
    if (e2) console.error('[analytics/click] fallback error:', e2.message)
  }

  return json({ ok: true })
}