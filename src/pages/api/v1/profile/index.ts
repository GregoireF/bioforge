// src/pages/api/profile/index.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { sanitizeTheme }          from '@/lib/modules/profile/theme'
import { profileUpdateSchema }    from '@/lib/schemas'
import type { ProfileUpdateInput } from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { dbPayload, toJson }      from '@/lib/db'

export const GET: APIRoute = wrapApiHandler(
  async ({ profile }: ApiHandlerContext) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, theme, plan')
      .eq('id', profile.id)
      .single()

    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return data
  }
)

export const PUT: APIRoute = wrapApiHandler<ProfileUpdateInput>(
  async ({ profile, body }: ApiHandlerContext<ProfileUpdateInput>) => {
    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = profileUpdateSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400, meta: parsed.error.flatten() })

    const update: Record<string, unknown> = {}

    if (parsed.data.theme !== undefined) {
      if (typeof parsed.data.theme !== 'object' || Array.isArray(parsed.data.theme))
        throw new AppError({ message: 'theme must be an object', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })
      update.theme = toJson(sanitizeTheme(parsed.data.theme))
    }

    if (typeof parsed.data.display_name === 'string')
      update.display_name = parsed.data.display_name.trim().slice(0, 80) || null

    if (typeof parsed.data.bio === 'string')
      update.bio = parsed.data.bio.trim().slice(0, 320) || null

    if (Object.keys(update).length === 0)
      throw new AppError({ message: 'No valid fields to update', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(dbPayload({ ...update, updated_at: new Date().toISOString() }))
      .eq('id', profile.id)
      .select('id, username, display_name, bio, theme, updated_at')
      .single()

    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return data
  },
  { requireBody: true }
)