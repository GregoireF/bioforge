import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { z }                      from 'zod'

const readSchema = z.object({
  id: z.number().int().positive().optional(),
}).strict()

type ReadBody = z.infer<typeof readSchema>

export const PATCH: APIRoute = wrapApiHandler<ReadBody, { updated: number }>(
  async ({ supabase, user, body }: ApiHandlerContext<ReadBody>) => {
    const parsed = readSchema.safeParse(body ?? {})
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    // ✅ SDK Supabase v2 : .update() ne supporte pas { count } en option
    // On récupère d'abord les IDs à marquer, puis on update
    let selectQuery = supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (parsed.data.id !== undefined)
      selectQuery = selectQuery.eq('id', parsed.data.id)

    const { data: toUpdate, error: selectError } = await selectQuery

    if (selectError)
      throw new AppError({ message: selectError.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    if (!toUpdate || toUpdate.length === 0)
      return { updated: 0 }

    const ids = toUpdate.map(n => n.id)

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids)
      .eq('user_id', user.id)

    if (updateError)
      throw new AppError({ message: updateError.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    return { updated: ids.length }
  }
)