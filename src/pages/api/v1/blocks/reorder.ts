// src/pages/api/blocks/reorder.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { reorderBlocks }          from '@/lib/db'
import { reorderBlocksSchema }    from '@/lib/schemas'
import type { ReorderBlockInput } from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'

export const POST: APIRoute = wrapApiHandler<ReorderBlockInput>(
  async ({ supabase, profile, body }: ApiHandlerContext<ReorderBlockInput>) => {
    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = reorderBlocksSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400,
        meta: parsed.error.flatten() })

    const result = await reorderBlocks(supabase, parsed.data.blockIds, profile.id)
    if (!result.success)
      throw new AppError({ message: result.error.message, code: ErrorCode.DB_ERROR, statusCode: 500,
        meta: 'failed' in result.error && result.error.failed.length > 0 ? { failed: result.error.failed } : undefined })

    return { reordered: parsed.data.blockIds.length }
  },
  { requireBody: true }
)