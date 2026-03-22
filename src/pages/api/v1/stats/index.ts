// src/pages/api/stats/index.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { getAnalyticsSummary }    from '@/lib/db'
import { analyticsDaysFullSchema } from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'

export const GET: APIRoute = wrapApiHandler(
  async ({ supabase, profile, context }: ApiHandlerContext) => {
    const url    = new URL(context.request.url)
    const parsed = analyticsDaysFullSchema.safeParse(url.searchParams.get('days') ?? '7')
    if (!parsed.success)
      throw new AppError({ message: 'Paramètre days invalide (1-180)', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const result = await getAnalyticsSummary(supabase, profile.id, parsed.data)
    if (!result.success)
      throw new AppError({ message: result.error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    const { summary, profileStats, blockStats, topBlocks } = result.value
    return {
      summary: { totalViews: summary.totalViews ?? 0, totalClicks: summary.totalClicks ?? 0,
        clickRate: summary.clickRate ?? 0, activeBlocks: summary.activeBlocks ?? 0 },
      profileStats: (profileStats ?? []).map(s => ({ date: s.date, views: s.views ?? 0 })),
      blockStats:   (blockStats   ?? []).map(s => ({ date: s.date, block_id: s.block_id, clicks: s.clicks ?? 0 })),
      topBlocks:    (topBlocks    ?? []).map(b => ({ id: b.id, type: b.type, title: b.title ?? 'Sans titre', clicks: b.clicks ?? 0 })),
    }
  }
)