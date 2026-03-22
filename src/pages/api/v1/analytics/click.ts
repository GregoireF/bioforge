// src/pages/api/analytics/click.ts
import type { APIRoute }          from 'astro'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { buildAnalyticsPayload }  from '@/lib/modules/analytics/pipeline'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rate-limit'
import { clickSchema }            from '@/lib/schemas'
import { json }                   from '@/lib/core/http'

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  let body: unknown
  try { body = await request.json() }
  catch { return new Response(null, { status: 400 }) }

  const parsed = clickSchema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })

  const d = parsed.data

  const payload = await buildAnalyticsPayload(request, { referrer: d.referrer, utm_source: d.utm_source, utm_medium: d.utm_medium, utm_campaign: d.utm_campaign })
  if (payload.isBot) return json({ ok: true, skipped: 'bot', name: payload.botName })

  // Ownership — résoudre profile_id depuis block_id
  const { data: block, error: blockError } = await supabaseAdmin
    .from('blocks')
    .select('profile_id')
    .eq('id', d.block_id)
    .is('deleted_at', null)
    .single()

  if (blockError || !block) return json({ ok: false })

  const { allowed } = await checkRateLimit('analytics_click', payload.ipHash)
  if (!allowed) return rateLimitedResponse(60)

  // RPC compteur journalier
  const today = new Date().toISOString().split('T')[0]
  const { error: rpcError } = await supabaseAdmin.rpc('increment_block_clicks', {
    p_block_id: d.block_id, p_date: today,
  })
  if (rpcError) console.error('[analytics/click] rpc error:', rpcError.message)

  const { error: insertError } = await supabaseAdmin.from('block_clicks').insert({
    block_id:    d.block_id,
    profile_id:  block.profile_id,
    ip_hash:     payload.ipHash,
    device_type: payload.device_type,
    os:          payload.os,
    browser:     payload.browser,
    referrer:    payload.referrer,
    utm_source:  payload.utm_source,
    utm_medium:  payload.utm_medium,
    utm_campaign: payload.utm_campaign,
    country:     payload.country,
    city:        payload.city,
    is_vpn:      payload.is_vpn,
    is_hosting:  payload.is_hosting,
  })

  if (insertError) console.error('[analytics/click] insert error:', insertError.message)

  return json({ ok: true })
}