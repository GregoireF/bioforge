import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { Audit }                  from '@/lib/security/audit'
import { dbPayload }              from '@/lib/db'

export const POST: APIRoute = wrapApiHandler(
  async ({ profile, context }: ApiHandlerContext) => {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update(dbPayload({
        deleted_at: new Date().toISOString(),
        is_active:  false,
      }))
      .eq('id', profile.id)

    if (error)
      throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    await Audit.gdprDeletionRequested(profile.id, context.request)

    return { deleted: true }
  }
)