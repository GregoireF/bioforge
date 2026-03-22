// src/pages/api/profile/check-username.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { usernameSchema }         from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'

export const GET: APIRoute = wrapApiHandler<undefined, { available: boolean; username: string }>(
  async ({ supabase, context }: ApiHandlerContext<undefined>) => {
    const raw = context.url.searchParams.get('username') ?? ''

    const result = usernameSchema.safeParse(raw)
    if (!result.success)
      throw new AppError({ message: 'Format invalide (3-24 chars, a-z0-9_)', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const username = result.data // déjà lowercased+trimmed par .transform()

    const { data, error } = await supabase
      .from('profiles').select('username').eq('username', username).maybeSingle()

    if (error) throw new AppError({ message: 'Failed to check username', code: ErrorCode.DB_ERROR, statusCode: 500 })

    return { available: data === null, username }
  }
)