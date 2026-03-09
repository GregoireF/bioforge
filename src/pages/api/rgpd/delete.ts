import type { APIRoute } from 'astro'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@supabase/supabase-js'
import { hashIP, getIP } from '@/lib/analytics/helpers'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rate-limit'
import { Audit } from '@/lib/security/audit'
import { notifyGdprDeletionRequest, notifyGdprDeletionConfirm } from '@/lib/security/email-notify'
import { z } from 'zod'

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

const schema = z.object({
  confirm: z.literal('DELETE MY ACCOUNT'),
  reason:  z.string().max(500).optional(),
})

export const POST: APIRoute = async (context) => {
  const { request } = context

  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  // 1. Auth
  const auth = await requireUser(context)
  if ('error' in auth)
    return new Response(JSON.stringify({ error: auth.error }), { status: 401 })

  const profileId = auth.user.id
  const ip        = getIP(request)
  const ipHash    = hashIP(ip)

  // 2. Rate limiting (2 tentatives/heure max)
  const { allowed } = await checkRateLimit('gdpr_delete', ipHash)
  if (!allowed) {
    await Audit.rateLimitBlocked(profileId, 'gdpr_delete', ipHash)
    return rateLimitedResponse(3600)
  }

  // 3. Parse + validate
  let body: unknown
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return new Response(JSON.stringify({
      error:   'missing_confirmation',
      message: 'Envoyez { "confirm": "DELETE MY ACCOUNT" } pour confirmer.',
    }), { status: 400 })

  // 4. Récupère email + username avant suppression
  const { data: userData } = await supabase.auth.admin.getUserById(profileId)
  const userEmail    = userData?.user?.email ?? null
  const userUsername = auth.user.user_metadata?.username ?? 'utilisateur'

  // 5. Audit + gdpr_requests
  await Audit.gdprDeletionRequested(profileId, request)
  await supabase.from('gdpr_requests').insert({
    profile_id:   profileId,
    type:         'deletion',
    status:       'processing',
    ip_hash:      ipHash,
    notes:        parsed.data.reason ?? null,
  })

  // 6. Email réception
  if (userEmail) await notifyGdprDeletionRequest(userEmail, userUsername)

  // 7. RPC suppression
  const { data, error } = await supabase.rpc('gdpr_delete_profile', {
    p_profile_id: profileId,
  })

  if (error) {
    console.error('[gdpr/delete] rpc error:', error.message)
    await Audit.gdprDeletionFailed(profileId, error.message)
    await supabase.from('gdpr_requests')
      .update({ status: 'failed', processed_at: new Date().toISOString() })
      .eq('profile_id', profileId).eq('status', 'processing')
    return new Response(JSON.stringify({ error: 'deletion_failed' }), { status: 500 })
  }

  // 8. Supprime auth.users
  const { error: authError } = await supabase.auth.admin.deleteUser(profileId)
  if (authError) console.error('[gdpr/delete] auth delete error:', authError.message)

  // 9. Statut final
  await supabase.from('gdpr_requests')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('profile_id', profileId).eq('status', 'processing')

  // 10. Email confirmation
  if (userEmail) await notifyGdprDeletionConfirm(userEmail, userUsername)

  return new Response(JSON.stringify({
    success: true,
    message: 'Votre compte et toutes vos données ont été supprimés.',
    summary: data,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}