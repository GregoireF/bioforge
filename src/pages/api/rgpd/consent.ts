import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import { getIP, hashIP } from '@/lib/analytics/helpers'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rate-limit'
import { Audit } from '@/lib/security/audit'
import { z } from 'zod'

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

const schema = z.object({
  profile_id:  z.string().uuid(),
  analytics:   z.boolean(),
  // Action explicite : 'accept' | 'reject' | 'withdraw'
  action:      z.enum(['accept', 'reject', 'withdraw']).default('accept'),
  // Source du consentement (banner / settings / api)
  source:      z.enum(['banner', 'settings', 'api']).default('banner'),
})

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  const ip     = getIP(request)
  const ipHash = hashIP(ip)

  // Rate limiting
  const { allowed } = await checkRateLimit('gdpr_consent', ipHash)
  if (!allowed) return rateLimitedResponse(60)

  let body: unknown
  try { body = await request.json() } catch {
    return new Response(null, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })

  const { profile_id, analytics, action, source } = parsed.data
  const ua = (request.headers.get('user-agent') || '').slice(0, 200)

  // Enregistre le consentement (preuve légale Art. 7 RGPD)
  const { error } = await supabase.from('consent_logs').insert({
    profile_id,
    ip_hash:              ipHash,
    analytics,
    action,
    source,
    consent_text_version: 'v2',
    user_agent:           ua,
  })

  if (error) {
    console.error('[gdpr/consent] insert error:', error.message)
    return new Response(JSON.stringify({ error: 'consent_log_failed' }), { status: 500 })
  }

  // Audit trail
  await Audit.consentRecorded(profile_id, analytics, action, request)

  return new Response(JSON.stringify({ ok: true, analytics, action }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}