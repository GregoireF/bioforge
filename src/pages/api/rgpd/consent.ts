import type { APIRoute }          from 'astro'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { getIP, hashIP }          from '@/lib/analytics/helpers'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rate-limit'
import { Audit }                  from '@/lib/security/audit'
import { json }                   from '@/lib/core/http'
import { z }                      from 'zod'

const schema = z.object({
  profile_id: z.string().uuid(),
  analytics:  z.boolean(),
  action:     z.enum(['accept', 'reject', 'withdraw']).default('accept'),
  source:     z.enum(['banner', 'settings', 'api']).default('banner'),
})

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  const ip     = getIP(request)
  const ipHash = await hashIP(ip)

  const { allowed } = await checkRateLimit('gdpr_consent', ipHash)
  if (!allowed) return rateLimitedResponse(60)

  let body: unknown
  try { body = await request.json() }
  catch { return json({ error: 'invalid_json' }, 400) }

  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return json({ error: 'validation_error', issues: parsed.error.flatten().fieldErrors }, 400)

  const { profile_id, analytics, action, source } = parsed.data
  const ua = request.headers.get('user-agent')?.slice(0, 200) ?? ''

  const { error } = await supabaseAdmin.from('consent_logs').insert({
    profile_id,
    ip_hash:              ipHash,
    analytics,
    action,
    source,
    consent_text_version: 'v2',
    user_agent:           ua,
  })

  if (error) {
    console.error('[rgpd/consent] insert error:', error.message)
    return json({ error: 'consent_log_failed' }, 500)
  }

  await Audit.consentRecorded(profile_id, analytics, action, request)

  return json({ ok: true, analytics, action })
}