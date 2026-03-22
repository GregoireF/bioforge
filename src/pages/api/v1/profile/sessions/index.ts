import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { AppError, ErrorCode }    from '@/lib/core/errors'

interface Session {
  id:          string
  browser:     string | null
  os:          string | null
  device_type: string | null
  last_seen:   string | null
  created_at:  string | null
}

export const GET: APIRoute = wrapApiHandler<undefined, Session[]>(
  async ({ supabase, user }: ApiHandlerContext<undefined>) => {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('id, browser, os, device_type, last_seen, created_at')
      .eq('user_id', user.id)
      .order('last_seen', { ascending: false })

    if (error)
      throw new AppError({ message: 'Failed to fetch sessions', code: ErrorCode.DB_ERROR, statusCode: 500 })

    return data ?? []
  }
)

export const DELETE: APIRoute = wrapApiHandler<undefined, { revoked: number }>(
  async ({ supabase, user, context }: ApiHandlerContext<undefined>) => {
    const currentSessionId = context.request.headers.get('x-session-id')?.trim() ?? null

    let query = supabase.from('user_sessions').delete().eq('user_id', user.id)
    if (currentSessionId) query = query.neq('id', currentSessionId)

    const { error, count } = await query

    if (error)
      throw new AppError({ message: 'Failed to revoke sessions', code: ErrorCode.DB_ERROR, statusCode: 500 })

    return { revoked: count ?? 0 }
  }
)