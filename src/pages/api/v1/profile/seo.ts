// src/pages/api/profile/seo.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { seoSchema }              from '@/lib/schemas'
import type { SeoInput }          from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { isPaidPlan }             from '@/lib/db'
import type { Plan }              from '@/lib/db'
import { dbPayload }              from '@/lib/db'

export const POST: APIRoute = wrapApiHandler<SeoInput>(
  async ({ profile, body }: ApiHandlerContext<SeoInput>) => {
    if (!isPaidPlan(profile.plan as Plan))
      throw new AppError({ message: 'Plan Creator requis pour le SEO avancé', code: ErrorCode.FORBIDDEN, statusCode: 403 })

    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = seoSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400,
        meta: parsed.error.flatten() })

    const update: Record<string, unknown> = {}
    if (parsed.data.seo_keywords !== undefined)
      update.seo_keywords = parsed.data.seo_keywords.map(k => k.trim().toLowerCase())
    if (parsed.data.seo_description !== undefined)
      update.seo_description = parsed.data.seo_description?.trim() || null

    if (Object.keys(update).length === 0)
      throw new AppError({ message: 'Aucune donnée valide', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const { data, error } = await supabaseAdmin
      .from('profiles').update(dbPayload(update)).eq('id', profile.id)
      .select('seo_keywords, seo_description').single()

    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return data
  },
  { requireBody: true }
)