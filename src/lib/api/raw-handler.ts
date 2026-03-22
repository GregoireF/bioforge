import type { APIRoute, APIContext } from 'astro'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/infra/supabase/database.types'
import type { Profile, PlanLimit } from '@/lib/db'
import { withAuth } from '@/lib/auth/auth'
import { createSupabaseServer } from '@/lib/infra/supabase/server'
import { toAppError, ErrorCode } from '@/lib/core/errors'
import { logger } from '@/lib/core/logger'
import { json } from '@/lib/core/http'

export type AuthedContext = {
  context: APIContext
  user: User
  supabase: SupabaseClient<Database>
  profile: Profile
  planLimits: PlanLimit | null
}

export type AnonContext = {
  context: APIContext
}

type AuthedHandler = (ctx: AuthedContext) => Promise<Response> | Response
type AnonHandler = (ctx: AnonContext) => Promise<Response> | Response

async function executeAuthed(
  handler: AuthedHandler,
  context: APIContext
): Promise<Response> {
  const auth = await withAuth(context)

  if (!auth.success) {
    return json(
      {
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: auth.error.message,
        },
      },
      auth.error.statusCode
    )
  }

  const { user, profile, planLimits } = auth.value
  const supabase = createSupabaseServer(context)

  return handler({
    context,
    user,
    supabase,
    profile,
    planLimits,
  })
}

async function executeAnon(
  handler: AnonHandler,
  context: APIContext
): Promise<Response> {
  return handler({ context })
}

export function rawApiHandler(handler: AuthedHandler, opts: { requireAuth: true }): APIRoute
export function rawApiHandler(handler: AnonHandler, opts?: { requireAuth?: false }): APIRoute

export function rawApiHandler(
  handler: AuthedHandler | AnonHandler,
  { requireAuth = false }: { requireAuth?: boolean } = {}
): APIRoute {
  return async (context: APIContext) => {
    const start = Date.now()
    const requestId = crypto.randomUUID()

    try {
      const response = requireAuth
        ? await executeAuthed(handler as AuthedHandler, context)
        : await executeAnon(handler as AnonHandler, context)

      logger.info(
        {
          requestId,
          method: context.request.method,
          url: context.request.url,
          ms: Date.now() - start,
        },
        '[RAW] success'
      )

      return response
    } catch (err) {
      const appError = toAppError(err)

      logger.error(
        {
          requestId,
          method: context.request.method,
          url: context.request.url,
          ms: Date.now() - start,
        },
        appError.message
      )

      return json(
        {
          success: false,
          error: {
            code: appError.code,
            message: appError.message,
          },
        },
        appError.statusCode || 500
      )
    }
  }
}