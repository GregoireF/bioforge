import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { AppError, ErrorCode }    from '@/lib/core/errors'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DELETE: APIRoute = wrapApiHandler<undefined, { revoked: boolean }>(
  async ({ supabase, user, context }: ApiHandlerContext<undefined>) => {
    const sessionId = context.params.id?.trim() ?? ''

    if (!sessionId)
      throw new AppError({ message: 'Session ID requis', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    if (!UUID_RE.test(sessionId))
      throw new AppError({ message: 'Format de session ID invalide', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const { error, count } = await supabase
      .from('user_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (error)
      throw new AppError({ message: 'Failed to revoke session', code: ErrorCode.DB_ERROR, statusCode: 500 })

    if (count === 0)
      throw new AppError({ message: 'Session non trouvée', code: ErrorCode.NOT_FOUND, statusCode: 404 })

    return { revoked: true }
  }
)