// src/pages/api/links/[id].ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { updateLinkSchema }       from '@/lib/schemas'
import type { UpdateLinkInput }   from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { isValidUUID, dbPayload } from '@/lib/db'

function getLinkId(ctx: ApiHandlerContext): string {
  const id = ctx.context.params.id?.trim() ?? ''
  if (!isValidUUID(id))
    throw new AppError({ message: 'ID de lien invalide', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })
  return id
}

export const PATCH: APIRoute = wrapApiHandler<UpdateLinkInput>(
  async (ctx: ApiHandlerContext<UpdateLinkInput>) => {
    const linkId = getLinkId(ctx)
    if (!ctx.body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = updateLinkSchema.safeParse(ctx.body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400,
        meta: parsed.error.flatten() })

    const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined)
    if (fields.length === 0)
      throw new AppError({ message: 'Aucun champ à mettre à jour', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const { data, error } = await supabaseAdmin.from('short_links')
      .update(dbPayload({ ...parsed.data, updated_at: new Date().toISOString() }))
      .eq('id', linkId).eq('profile_id', ctx.profile.id).select().single()

    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    if (!data)  throw new AppError({ message: 'Lien non trouvé', code: ErrorCode.NOT_FOUND, statusCode: 404 })
    return data
  },
  { requireBody: true }
)

export const DELETE: APIRoute = wrapApiHandler(
  async (ctx: ApiHandlerContext) => {
    const linkId = getLinkId(ctx)
    const { error } = await supabaseAdmin.from('short_links')
      .delete().eq('id', linkId).eq('profile_id', ctx.profile.id)
    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return { deleted: true, id: linkId }
  }
)