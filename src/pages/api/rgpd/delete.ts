import type { APIRoute }          from 'astro'
import { wrapApiHandler, type ApiHandlerContext }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { getIP, hashIP }          from '@/lib/analytics/helpers'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { Audit }                  from '@/lib/security/audit'
import { notifyGdprDeletionRequest, notifyGdprDeletionConfirm } from '@/lib/security/email-notify'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { z }                      from 'zod'

const schema = z.object({
  confirm: z.literal('DELETE MY ACCOUNT'),
  reason:  z.string().max(500).optional(),
})

type DeleteBody = z.infer<typeof schema>

export const POST: APIRoute = wrapApiHandler<DeleteBody>(
  async ({ user, profile, body, context }: ApiHandlerContext<DeleteBody>) => {
    const { request } = context

    const ip     = getIP(request)
    const ipHash = await hashIP(ip)

    const { allowed } = await checkRateLimit('gdpr_delete', ipHash)
    if (!allowed) {
      await Audit.rateLimitBlocked(profile.id, 'gdpr_delete', ipHash)
      throw new AppError({ message: 'Too many requests', code: ErrorCode.RATE_LIMITED, statusCode: 429 })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success)
      throw new AppError({
        message: 'Envoyez { "confirm": "DELETE MY ACCOUNT" } pour confirmer',
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      })

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(user.id)
    const userEmail    = userData?.user?.email ?? null
    const userUsername = typeof user.user_metadata?.username === 'string'
      ? user.user_metadata.username
      : profile.username

    await Audit.gdprDeletionRequested(profile.id, request)
    await supabaseAdmin.from('gdpr_requests').insert({
      profile_id: profile.id,
      type:       'deletion',
      status:     'processing',
      ip_hash:    ipHash,
      notes:      parsed.data.reason ?? null,
    })

    if (userEmail) await notifyGdprDeletionRequest(userEmail, userUsername)

    const { data, error } = await supabaseAdmin.rpc('gdpr_delete_profile', {
      p_profile_id: profile.id,
    })

    if (error) {
      console.error('[rgpd/delete] rpc error:', error.message)
      await Audit.gdprDeletionFailed(profile.id, error.message)
      await supabaseAdmin.from('gdpr_requests')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('profile_id', profile.id).eq('status', 'processing')
      throw new AppError({ message: 'Deletion failed', code: ErrorCode.DB_ERROR, statusCode: 500 })
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (authError) console.error('[rgpd/delete] auth delete error:', authError.message)

    await supabaseAdmin.from('gdpr_requests')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('profile_id', profile.id).eq('status', 'processing')

    if (userEmail) await notifyGdprDeletionConfirm(userEmail, userUsername)

    return { success: true, message: 'Votre compte et toutes vos données ont été supprimés.', summary: data }
  },
  { requireBody: true }
)