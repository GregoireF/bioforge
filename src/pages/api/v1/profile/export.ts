import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { getProfile, getBlocks }  from '@/lib/db'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { Audit }                  from '@/lib/security/audit'

interface ExportData {
  exported_at: string
  profile:     Record<string, unknown>
  blocks:      unknown[]
}

export const GET: APIRoute = wrapApiHandler<undefined, ExportData>(
  async ({ user, supabase, context }: ApiHandlerContext<undefined>) => {
    const [profileResult, blocksResult] = await Promise.all([
      getProfile(supabase, user.id),
      getBlocks(supabase, user.id),
    ])

    if (!profileResult.success)
      throw new AppError({ message: 'Failed to fetch profile', code: ErrorCode.DB_ERROR, statusCode: 500 })

    const {
      stripe_customer_id: _stripe,
      gdpr_delete_requested_at: _gdpr1,
      gdpr_anonymized_at: _gdpr2,
      ...safeProfile
    } = profileResult.value as Record<string, unknown>

    await Audit.gdprExportRequested(user.id, context.request)

    return {
      exported_at: new Date().toISOString(),
      profile:     safeProfile,
      blocks:      blocksResult.success ? blocksResult.value : [],
    }
  }
)