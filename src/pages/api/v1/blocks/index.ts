// src/pages/api/blocks/index.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { getBlocks, createBlock } from '@/lib/db'
import { createBlockSchema }      from '@/lib/schemas'
import type { CreateBlockInput }  from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { toJson }                 from '@/lib/db'

export const GET: APIRoute = wrapApiHandler(
  async ({ supabase, profile }: ApiHandlerContext) => {
    const result = await getBlocks(supabase, profile.id)
    if (!result.success)
      throw new AppError({ message: result.error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return result.value
  }
)

export const POST: APIRoute = wrapApiHandler<CreateBlockInput>(
  async ({ supabase, profile, body }: ApiHandlerContext<CreateBlockInput>) => {
    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = createBlockSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400,
        meta: parsed.error.flatten() })

    const result = await createBlock(supabase, {
      profile_id: profile.id,
      type:       parsed.data.type,
      title:      parsed.data.title ?? null,
      config:     toJson(parsed.data.config ?? {}),
      active:     parsed.data.active ?? true,
      deleted_at: null,
    })
    if (!result.success)
      throw new AppError({ message: result.error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    return result.value
  },
  { requireBody: true }
)