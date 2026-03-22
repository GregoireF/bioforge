// src/pages/api/notifications/read.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { readNotifSchema }        from '@/lib/schemas'
import type { ReadNotifInput }    from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'

export const PATCH: APIRoute = wrapApiHandler<ReadNotifInput, { updated: number }>(
  async ({ supabase, user, body }: ApiHandlerContext<ReadNotifInput>) => {
    const parsed = readNotifSchema.safeParse(body ?? {})
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    let selectQuery = supabase.from('notifications').select('id')
      .eq('user_id', user.id).eq('is_read', false)
    if (parsed.data.id !== undefined) selectQuery = selectQuery.eq('id', parsed.data.id)

    const { data: toUpdate, error: selectError } = await selectQuery
    if (selectError) throw new AppError({ message: selectError.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    if (!toUpdate || toUpdate.length === 0) return { updated: 0 }

    const ids = toUpdate.map(n => n.id)
    const { error: updateError } = await supabase.from('notifications')
      .update({ is_read: true }).in('id', ids).eq('user_id', user.id)

    if (updateError) throw new AppError({ message: updateError.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return { updated: ids.length }
  }
)