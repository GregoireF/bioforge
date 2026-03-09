import type { APIRoute } from 'astro'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@supabase/supabase-js'
import { getIP, hashIP } from '@/lib/analytics/helpers'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rate-limit'
import { Audit } from '@/lib/security/audit'
import { notifyGdprExport } from '@/lib/security/email-notify'

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

export const POST: APIRoute = async (context) => {
  const { request } = context

  // 1. Auth
  const auth = await requireUser(context)
  if ('error' in auth)
    return new Response(JSON.stringify({ error: auth.error }), { status: 401 })

  const profileId = auth.user.id
  const ip        = getIP(request)
  const ipHash    = hashIP(ip)

  // 2. Rate limiting (5 exports/heure)
  const { allowed } = await checkRateLimit('gdpr_export', ipHash)
  if (!allowed) {
    await Audit.rateLimitBlocked(profileId, 'gdpr_export', ipHash)
    return rateLimitedResponse(3600)
  }

  // 3. Audit de la demande
  await Audit.gdprExportRequested(profileId, request)

  // 4. RPC export
  const { data, error } = await supabase.rpc('gdpr_export_profile', {
    p_profile_id: profileId,
  })

  if (error) {
    console.error('[gdpr/export] rpc error:', error.message)
    await Audit.gdprExportFailed(profileId, error.message)
    await supabase.from('gdpr_requests').insert({
      profile_id: profileId, type: 'export', status: 'failed',
      ip_hash: ipHash, processed_at: new Date().toISOString(),
    })
    return new Response(JSON.stringify({ error: 'export_failed' }), { status: 500 })
  }

  // 5. Log succès
  await Audit.gdprExportCompleted(profileId)
  await supabase.from('gdpr_requests').insert({
    profile_id: profileId, type: 'export', status: 'completed',
    ip_hash: ipHash, processed_at: new Date().toISOString(),
  })

  // 6. Email notification
  const { data: userData } = await supabase.auth.admin.getUserById(profileId)
  const userEmail    = userData?.user?.email ?? null
  const userUsername = auth.user.user_metadata?.username ?? 'utilisateur'
  if (userEmail) await notifyGdprExport(userEmail, userUsername)

  const filename = `bioforge-data-export-${new Date().toISOString().split('T')[0]}.json`

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}