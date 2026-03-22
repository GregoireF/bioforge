// src/lib/modules/gdpr/deletion.ts
// Orchestration de la suppression RGPD — partagé entre rgpd/delete.ts et profile/delete.ts
import { supabaseAdmin }    from '@/lib/infra/supabase/admin'
import { Audit }            from '@/lib/security/audit'
import {
  notifyGdprDeletionRequest,
  notifyGdprDeletionConfirm,
} from '@/lib/security/email-notify'

export interface DeletionOptions {
  profileId: string
  userId:    string
  ipHash:    string
  reason?:   string
  request:   Request
}

export interface DeletionResult {
  success:  boolean
  summary?: unknown
  error?:   string
}

/**
 * Flow complet de suppression RGPD :
 * 1. Audit + gdpr_requests INSERT
 * 2. Email réception
 * 3. RPC gdpr_delete_profile (anonymise profil + blocs + analytics)
 * 4. deleteUser auth.users
 * 5. gdpr_requests UPDATE status
 * 6. Email confirmation
 */
export async function executeDeletion(opts: DeletionOptions): Promise<DeletionResult> {
  const { profileId, userId, ipHash, reason, request } = opts

  // Récupère email avant suppression
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const userEmail    = userData?.user?.email ?? null
  const userUsername = typeof userData?.user?.user_metadata?.username === 'string'
    ? userData.user.user_metadata.username
    : 'utilisateur'

  // Audit + enregistrement de la demande
  await Audit.gdprDeletionRequested(profileId, request)
  await supabaseAdmin.from('gdpr_requests').insert({
    profile_id: profileId,
    type:       'deletion',
    status:     'processing',
    ip_hash:    ipHash,
    notes:      reason ?? null,
  })

  // Email réception immédiate
  if (userEmail) await notifyGdprDeletionRequest(userEmail, userUsername)

  // RPC suppression
  const { data, error } = await supabaseAdmin.rpc('gdpr_delete_profile', {
    p_profile_id: profileId,
  })

  if (error) {
    await Audit.gdprDeletionFailed(profileId, error.message)
    await supabaseAdmin.from('gdpr_requests')
      .update({ status: 'failed', processed_at: new Date().toISOString() })
      .eq('profile_id', profileId).eq('status', 'processing')
    return { success: false, error: error.message }
  }

  // Supprime auth.users
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authError) console.error('[gdpr/deletion] auth delete error:', authError.message)

  // Statut final
  await supabaseAdmin.from('gdpr_requests')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('profile_id', profileId).eq('status', 'processing')

  // Email confirmation
  if (userEmail) await notifyGdprDeletionConfirm(userEmail, userUsername)

  return { success: true, summary: data }
}