// src/pages/api/analytics/view.ts
import type { APIRoute }          from 'astro'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { buildAnalyticsPayload }  from '@/lib/modules/analytics/pipeline'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rate-limit'
import { viewSchema }             from '@/lib/schemas'
import { json }                   from '@/lib/core/http'

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  let body: unknown
  try { body = await request.json() }
  catch { return new Response(null, { status: 400 }) }

  const parsed = viewSchema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })

  const d = parsed.data

  const payload = await buildAnalyticsPayload(request, {
    referrer: d.referrer, utm_source: d.utm_source, utm_medium: d.utm_medium,
    utm_campaign: d.utm_campaign, utm_content: d.utm_content, utm_term: d.utm_term,
  })

  // Bots nommés — log sans compteur
  if (payload.isBot) {
    if (payload.botName) {
      supabaseAdmin.from('profile_views').insert({
        profile_id: d.profile_id, device_type: 'bot',
        browser: payload.botName, is_hosting: true,
      }).then(() => {})
    }
    return json({ ok: true, skipped: 'bot' })
  }

  const { allowed } = await checkRateLimit('analytics_view', payload.ipHash)
  if (!allowed) return rateLimitedResponse(60)

  // Déduplication 24h
  const since24h = new Date(Date.now() - 86400000).toISOString()
  const { count } = await supabaseAdmin
    .from('profile_views')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', d.profile_id)
    .eq('ip_hash', payload.ipHash)
    .neq('device_type', 'bot')
    .gte('viewed_at', since24h)

  if ((count ?? 0) > 0) return json({ ok: true, skipped: 'dedup_24h' })

  // RPC compteur journalier
  const today = new Date().toISOString().split('T')[0]
  const { error: rpcError } = await supabaseAdmin.rpc('increment_profile_views', {
    p_profile_id: d.profile_id, p_date: today,
  })
  if (rpcError) console.error('[analytics/view] rpc error:', rpcError.message)

  const { error: insertError } = await supabaseAdmin.from('profile_views').insert({
    profile_id:    d.profile_id,
    ip_hash:       payload.ipHash,
    device_type:   payload.device_type,
    os:            payload.os,
    browser:       payload.browser,
    referrer:      payload.referrer,
    referrer_full: payload.referrer_full,
    utm_source:    payload.utm_source,
    utm_medium:    payload.utm_medium,
    utm_campaign:  payload.utm_campaign,
    utm_content:   payload.utm_content,
    utm_term:      payload.utm_term,
    country:       payload.country,
    city:          payload.city,
    is_vpn:        payload.is_vpn,
    is_hosting:    payload.is_hosting,
  })

  if (insertError) console.error('[analytics/view] insert error:', insertError.message)

  return json({ ok: true })
}