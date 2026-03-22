import type { APIRoute, APIContext } from 'astro'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/infra/supabase/database.types'
import type { Profile, PlanLimit } from '@/lib/db'
import { withAuth } from '@/lib/auth/auth'
import { createSupabaseServer } from '@/lib/infra/supabase/server'
import { verifyContentType } from '@/lib/security/headers'
import { verifyCSRF } from '@/lib/security/csrf'
import { AppError, toAppError, ErrorCode } from '@/lib/core/errors'
import { logger } from '@/lib/core/logger'
import { json } from '@/lib/core/http'

export type ApiHandlerContext<TReq = unknown> = {
  context: APIContext
  user: User
  supabase: SupabaseClient<Database>
  profile: Profile
  planLimits: PlanLimit | null
  body: TReq
}

export type ApiHandler<TReq = unknown, TRes = unknown> = (
  ctx: ApiHandlerContext<TReq>
) => Promise<TRes> | TRes

export interface WrapApiOptions {
  requireBody?: boolean
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function wrapApiHandler<TReq = unknown, TRes = unknown>(
  handler: ApiHandler<TReq, TRes>,
  options?: WrapApiOptions
): APIRoute {
  return async (context: APIContext) => {
    const { request } = context
    const start = Date.now()
    const requestId = crypto.randomUUID()

    try {
      // ── Auth
      const auth = await withAuth(context)
      if (!auth.success) {
        return json(
          { success: false, error: { code: ErrorCode.UNAUTHORIZED, message: auth.error.message } },
          auth.error.statusCode
        )
      }

      const { user, profile, planLimits } = auth.value
      const supabase = createSupabaseServer(context)

      const isMutating = MUTATING.has(request.method)

      // ── Security
      if (isMutating) {
        if (!verifyContentType(request)) {
          throw new AppError({
            message: 'Content-Type must be application/json',
            code: ErrorCode.VALIDATION_ERROR,
            statusCode: 415,
          })
        }

        if (!verifyCSRF(request)) {
          throw new AppError({
            message: 'CSRF validation failed',
            code: ErrorCode.FORBIDDEN,
            statusCode: 403,
          })
        }
      }

      // ── Body
      let body: TReq = {} as TReq

      if (isMutating) {
        try {
          body = await request.json()
        } catch {
          throw new AppError({
            message: 'Invalid JSON body',
            code: ErrorCode.VALIDATION_ERROR,
            statusCode: 400,
          })
        }

        if (
          options?.requireBody &&
          (
            body == null ||
            typeof body !== 'object' ||
            Array.isArray(body) ||
            !body || Object.keys(body).length === 0
          )
        ) {
          throw new AppError({
            message: 'Request body is required',
            code: ErrorCode.VALIDATION_ERROR,
            statusCode: 400,
          })
        }
      }

      // ── Handler
      const result = await handler({
        context,
        user,
        supabase,
        profile,
        planLimits,
        body,
      })

      logger.info(
        {
          requestId,
          method: request.method,
          url: request.url,
          ms: Date.now() - start,
          userId: user.id,
        },
        '[API] success'
      )

      return json({ success: true, data: result }, 200)

    } catch (err) {
      const appError = toAppError(err)

      logger.error(
        {
          requestId,
          method: context.request.method,
          url: context.request.url,
          ms: Date.now() - start,
          code: appError.code,
        },
        appError.message
      )

      return json(
        {
          success: false,
          error: {
            code: appError.code,
            message: appError.message,
            meta: appError.meta,
          },
        },
        appError.statusCode || 500
      )
    }
  }
}