import type { APIRoute } from 'astro'
import { requireUser } from '@/lib/auth/require-user'
import { verifyContentType } from '@/lib/security/headers'
import { verifyCSRF } from '@/lib/security/csrf'
import { success, error } from '@/lib/core/http'
import { z } from 'zod'
import { reorderBlocks } from '@/lib/db/queries.server'

// ==================== VALIDATION ====================

const reorderSchema = z.object({
  blockIds: z.array(z.string().uuid()),
}).strip()

// ==================== REORDER BLOCKS ====================

export const POST: APIRoute = async (context) => {
  const { request } = context

  if (!verifyContentType(request))
    return error('INVALID_CONTENT_TYPE', 415)

  if (!verifyCSRF(request))
    return error('CSRF_FAILED', 403)

  const auth = await requireUser(context)
  if ('error' in auth) return error(auth.error, 401)

  const body = await request.json()
  const parsed = reorderSchema.safeParse(body)

  if (!parsed.success)
    return error('VALIDATION_ERROR', 400, parsed.error.flatten())

  if (parsed.data.blockIds.length === 0)
    return error('EMPTY_ARRAY', 400)

  const { error: dbError } = await reorderBlocks(
    auth.supabase,
    auth.user.id,
    parsed.data.blockIds
  )

  if (dbError) {
    // Check if some blocks failed
    if ('failed' in dbError && dbError.failed.length > 0) {
      return error('REORDER_PARTIAL_FAILURE', 500, {
        failed: dbError.failed,
        message: dbError.message
      })
    }
    return error('REORDER_FAILED', 500)
  }

  return success(null)
}