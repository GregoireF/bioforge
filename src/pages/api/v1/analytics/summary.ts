// src/pages/api/analytics/summary.ts
import type { APIRoute }           from 'astro'
import type { ApiHandlerContext }  from '@/lib/api/handler'
import { wrapApiHandler }          from '@/lib/api/handler'
import { getAnalyticsSummary }     from '@/lib/db'
import { analyticsDaysStrictSchema } from '@/lib/schemas'
import { AppError, ErrorCode }     from '@/lib/core/errors'
import { isPaidPlan }              from '@/lib/db'
import type { Plan }               from '@/lib/db'

export const GET: APIRoute = wrapApiHandler(
  async ({ supabase, profile, context }: ApiHandlerContext) => {
    const url    = new URL(context.request.url)
    const parsed = analyticsDaysStrictSchema.safeParse(url.searchParams.get('days') ?? '7')
    if (!parsed.success)
      throw new AppError({ message: 'days doit être 7, 30 ou 90', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const days = parsed.data
    if (days > 7 && !isPaidPlan(profile.plan as Plan))
      throw new AppError({ message: 'Plan payant requis pour > 7j', code: ErrorCode.FORBIDDEN, statusCode: 403 })

    const result = await getAnalyticsSummary(supabase, profile.id, days)
    if (!result.success)
      throw new AppError({ message: result.error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    return result.value
  }
)