import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getIP, hashIP } from '@/lib/analytics/helpers'

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

export type AuditAction =
  // Analytics
  | 'analytics_view'
  | 'analytics_click'
  | 'analytics_view_blocked_ratelimit'
  | 'analytics_click_blocked_ratelimit'
  // RGPD
  | 'gdpr_export_requested'
  | 'gdpr_export_completed'
  | 'gdpr_export_failed'
  | 'gdpr_deletion_requested'
  | 'gdpr_deletion_completed'
  | 'gdpr_deletion_failed'
  | 'gdpr_consent_accepted'
  | 'gdpr_consent_rejected'
  | 'gdpr_consent_withdrawn'
  // Auth
  | 'auth_login_success'
  | 'auth_login_failed'
  | 'auth_signup'
  | 'auth_password_reset'
  | 'auth_mfa_enabled'
  | 'auth_session_revoked'
  // Profil
  | 'profile_updated'
  | 'profile_avatar_updated'
  | 'profile_theme_updated'
  // Admin
  | 'admin_profile_viewed'
  | 'admin_subscription_modified'

export type AuditSeverity = 'info' | 'warning' | 'critical'
export type AuditResult   = 'success' | 'failure' | 'blocked'
export type AuditResource =
  | 'profile' | 'block' | 'analytics' | 'session'
  | 'subscription' | 'gdpr_request' | 'consent' | 'auth'

export interface AuditEntry {
  profile_id?:    string
  action:         AuditAction
  resource_type?: AuditResource
  resource_id?:   string
  severity?:      AuditSeverity
  result?:        AuditResult
  actor_ip_hash?: string
  metadata?:      Record<string, unknown>
}

/**
 * Insère une entrée dans audit_logs.
 * Non-bloquant — ne fait jamais échouer la requête principale.
 */
export async function auditLog(
  entry:    AuditEntry,
  client?:  SupabaseClient  // optionnel : utilise le client partagé par défaut
): Promise<void> {
  const db = client ?? supabase

  const payload = {
    profile_id:    entry.profile_id   ?? null,
    action:        entry.action,
    resource_type: entry.resource_type ?? null,
    resource_id:   entry.resource_id   ?? null,
    severity:      entry.severity      ?? 'info',
    result:        entry.result        ?? 'success',
    actor_ip_hash: entry.actor_ip_hash ?? null,
    metadata:      entry.metadata      ?? {},
    new_data:      null,
    old_data:      null,
  }

  const { error } = await db.from('audit_logs').insert(payload)
  if (error) {
    // Ne jamais faire échouer la requête principale à cause d'un log
    console.error('[audit] insert failed:', error.message, '| action:', entry.action)
  }
}

/**
 * Helper : crée une entrée audit depuis une Request Astro.
 * Extrait et hash l'IP automatiquement.
 */
export async function auditFromRequest(
  request: Request,
  entry:   Omit<AuditEntry, 'actor_ip_hash'>
): Promise<void> {
  const ip     = getIP(request)
  const ipHash = hashIP(ip)
  return auditLog({ ...entry, actor_ip_hash: ipHash })
}

// ─────────────────────────────────────────────────────────────
// Actions pré-définies courantes — raccourcis typés
// ─────────────────────────────────────────────────────────────

export const Audit = {
  gdprExportRequested: (profileId: string, request: Request) =>
    auditFromRequest(request, {
      profile_id:    profileId,
      action:        'gdpr_export_requested',
      resource_type: 'gdpr_request',
      resource_id:   profileId,
      severity:      'info',
    }),

  gdprExportCompleted: (profileId: string) =>
    auditLog({
      profile_id:    profileId,
      action:        'gdpr_export_completed',
      resource_type: 'gdpr_request',
      resource_id:   profileId,
      severity:      'info',
    }),

  gdprExportFailed: (profileId: string, reason: string) =>
    auditLog({
      profile_id:    profileId,
      action:        'gdpr_export_failed',
      resource_type: 'gdpr_request',
      resource_id:   profileId,
      severity:      'warning',
      result:        'failure',
      metadata:      { reason },
    }),

  gdprDeletionRequested: (profileId: string, request: Request) =>
    auditFromRequest(request, {
      profile_id:    profileId,
      action:        'gdpr_deletion_requested',
      resource_type: 'gdpr_request',
      resource_id:   profileId,
      severity:      'critical',
    }),

  gdprDeletionFailed: (profileId: string, reason: string) =>
    auditLog({
      profile_id:    profileId,
      action:        'gdpr_deletion_failed',
      resource_type: 'gdpr_request',
      resource_id:   profileId,
      severity:      'critical',
      result:        'failure',
      metadata:      { reason },
    }),

  rateLimitBlocked: (profileId: string | null, route: string, ipHash: string) =>
    auditLog({
      profile_id:    profileId ?? undefined,
      action:        route.includes('view')
                       ? 'analytics_view_blocked_ratelimit'
                       : 'analytics_click_blocked_ratelimit',
      resource_type: 'analytics',
      severity:      'warning',
      result:        'blocked',
      actor_ip_hash: ipHash,
      metadata:      { route },
    }),

  consentRecorded: (profileId: string, analytics: boolean, action: string, request: Request) =>
    auditFromRequest(request, {
      profile_id:    profileId,
      action:        analytics ? 'gdpr_consent_accepted' : 'gdpr_consent_rejected',
      resource_type: 'consent',
      resource_id:   profileId,
      severity:      'info',
      metadata:      { analytics, action },
    }),
}