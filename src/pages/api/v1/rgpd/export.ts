import type { APIRoute }          from 'astro'
import { rawApiHandler }          from '@/lib/api/raw-handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { getIP, hashIP }          from '@/lib/analytics/helpers'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rate-limit'
import { Audit }                  from '@/lib/security/audit'
import { notifyGdprExport }       from '@/lib/security/email-notify'
import { json }                   from '@/lib/core/http'

export const POST: APIRoute = rawApiHandler(
  async ({ context, user, profile }) => {
    const { request } = context

    const ip     = getIP(request)
    const ipHash = await hashIP(ip)

    const { allowed } = await checkRateLimit('gdpr_export', ipHash)
    if (!allowed) {
      await Audit.rateLimitBlocked(profile!.id, 'gdpr_export', ipHash)
      return rateLimitedResponse(3600)
    }

    await Audit.gdprExportRequested(profile!.id, request)

    const { data, error } = await supabaseAdmin.rpc('gdpr_export_profile', {
      p_profile_id: profile!.id,
    })

    if (error) {
      console.error('[rgpd/export] rpc error:', error.message)
      await Audit.gdprExportFailed(profile!.id, error.message)
      await supabaseAdmin.from('gdpr_requests').insert({
        profile_id:   profile!.id,
        type:         'export',
        status:       'failed',
        ip_hash:      ipHash,
        processed_at: new Date().toISOString(),
      })
      return json({ error: 'export_failed' }, 500)
    }

    await Audit.gdprExportCompleted(profile!.id)
    await supabaseAdmin.from('gdpr_requests').insert({
      profile_id:   profile!.id,
      type:         'export',
      status:       'completed',
      ip_hash:      ipHash,
      processed_at: new Date().toISOString(),
    })

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(user!.id)
    const userEmail    = userData?.user?.email ?? null
    const userUsername = typeof user!.user_metadata?.username === 'string'
      ? user!.user_metadata.username
      : profile!.username

    if (userEmail) await notifyGdprExport(userEmail, userUsername)

    const filename = `bioforge-data-export-${new Date().toISOString().split('T')[0]}.json`

    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  },
  { requireAuth: true }
)