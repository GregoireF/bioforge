// src/pages/api/blocks/[id].ts
import type { APIRoute }                from 'astro'
import type { ApiHandlerContext }       from '@/lib/api/handler'
import { wrapApiHandler }               from '@/lib/api/handler'
import { updateBlock, softDeleteBlock } from '@/lib/db'
import { supabaseAdmin }                from '@/lib/infra/supabase/admin'
import { updateBlockSchema }            from '@/lib/schemas'
import type { UpdateBlockInput }        from '@/lib/schemas'
import { AppError, ErrorCode }          from '@/lib/core/errors'
import { isValidUUID, toJson }          from '@/lib/db'

function getBlockId(ctx: ApiHandlerContext): string {
  const id = ctx.context.params.id?.trim() ?? ''
  if (!isValidUUID(id))
    throw new AppError({ message: 'ID de bloc invalide', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })
  return id
}

export const GET: APIRoute = wrapApiHandler(
  async (ctx: ApiHandlerContext) => {
    const blockId = getBlockId(ctx)
    const { data, error } = await supabaseAdmin
      .from('blocks').select('*')
      .eq('id', blockId).eq('profile_id', ctx.profile.id).is('deleted_at', null).single()
    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    if (!data)  throw new AppError({ message: 'Block not found', code: ErrorCode.NOT_FOUND, statusCode: 404 })
    return data
  }
)

export const PUT: APIRoute = wrapApiHandler<UpdateBlockInput>(
  async (ctx: ApiHandlerContext<UpdateBlockInput>) => {
    const blockId = getBlockId(ctx)
    const { supabase, profile, body } = ctx

    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = updateBlockSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400,
        meta: parsed.error.flatten() })

    if (Object.keys(parsed.data).length === 0)
      throw new AppError({ message: 'Aucun champ à mettre à jour', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const { config: rawConfig, ...rest } = parsed.data
    const updates = { ...rest, ...(rawConfig !== undefined ? { config: toJson(rawConfig) } : {}) }

    const result = await updateBlock(supabase, blockId, profile.id, updates)
    if (!result.success)
      throw new AppError({ message: result.error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return result.value
  },
  { requireBody: true }
)

export const DELETE: APIRoute = wrapApiHandler(
  async (ctx: ApiHandlerContext) => {
    const blockId = getBlockId(ctx)
    const result = await softDeleteBlock(ctx.supabase, blockId, ctx.profile.id)
    if (!result.success)
      throw new AppError({ message: result.error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return { deleted: true, id: blockId }
  }
)