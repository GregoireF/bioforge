// src/pages/api/rgpd/delete.ts
import type { APIRoute }         from 'astro'
import { wrapApiHandler }        from '@/lib/api/handler'
import { executeDeletion }       from '@/lib/modules/rgpd/deletion'
import { getIP, hashIP }         from '@/lib/analytics/helpers'
import { checkRateLimit }        from '@/lib/security/rate-limit'
import { AppError, ErrorCode }   from '@/lib/core/errors'
import { Audit }                 from '@/lib/security/audit'
import { z }                     from 'zod'

const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE MY ACCOUNT'),
  reason:  z.string().max(500).optional(),
}).strict()

type DeleteBody = z.infer<typeof deleteAccountSchema>

export const POST: APIRoute = wrapApiHandler<DeleteBody>(
  async ({ user, profile, body, context }) => {
    const ip     = getIP(context.request)
    const ipHash = await hashIP(ip)

    const { allowed } = await checkRateLimit('gdpr_delete', ipHash)
    if (!allowed) {
      await Audit.rateLimitBlocked(profile.id, 'gdpr_delete', ipHash)
      throw new AppError({ message: 'Too many requests', code: ErrorCode.RATE_LIMITED, statusCode: 429 })
    }

    const parsed = deleteAccountSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Envoyez { "confirm": "DELETE MY ACCOUNT" }', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const result = await executeDeletion({
      profileId: profile.id,
      userId:    user.id,
      ipHash,
      reason:    parsed.data.reason,
      request:   context.request,
    })

    if (!result.success)
      throw new AppError({ message: result.error ?? 'Deletion failed', code: ErrorCode.DB_ERROR, statusCode: 500 })

    return { success: true, message: 'Compte supprimé.', summary: result.summary }
  },
  { requireBody: true }
)