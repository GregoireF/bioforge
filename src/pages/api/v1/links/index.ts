// src/pages/api/links/index.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { generateUniqueCode, normalizeCode } from '@/lib/modules/links/shortener'
import { createLinkSchema }       from '@/lib/schemas'
import type { CreateLinkInput }   from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { dbPayload }              from '@/lib/db'

export const GET: APIRoute = wrapApiHandler(
  async ({ profile }: ApiHandlerContext) => {
    const { data, error } = await supabaseAdmin
      .from('short_links').select('*').eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return data ?? []
  }
)

export const POST: APIRoute = wrapApiHandler<CreateLinkInput>(
  async ({ profile, planLimits, body, supabase }: ApiHandlerContext<CreateLinkInput>) => {
    if (!planLimits?.link_shortener)
      throw new AppError({ message: 'Plan Creator requis', code: ErrorCode.FORBIDDEN, statusCode: 403 })

    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = createLinkSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400, meta: parsed.error.flatten() })

    const { destination, code, title, expires_at, utm_source, utm_medium, utm_campaign } = parsed.data

    // Code déjà lowercased par le schema .transform()
    const finalCode = code
      ? (await (async () => {
          const normalized = normalizeCode(code)
          if (!normalized) throw new AppError({ message: 'Code invalide', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })
          const { data: existing } = await supabaseAdmin.from('short_links').select('id').eq('code', normalized).maybeSingle()
          if (existing) throw new AppError({ message: `Le code "${normalized}" est déjà pris`, code: ErrorCode.CONFLICT, statusCode: 409 })
          return normalized
        })())
      : await generateUniqueCode(supabase)

    const limit = planLimits?.short_links_count ?? null
    if (limit !== null) {
      const { count } = await supabaseAdmin.from('short_links')
        .select('*', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('is_active', true)
      if ((count ?? 0) >= limit)
        throw new AppError({ message: `Limite de ${limit} liens atteinte`, code: ErrorCode.FORBIDDEN, statusCode: 403 })
    }

    const { data, error } = await supabaseAdmin.from('short_links')
      .insert(dbPayload({ profile_id: profile.id, code: finalCode, destination, title: title ?? null,
        expires_at: expires_at ?? null, utm_source: utm_source ?? null,
        utm_medium: utm_medium ?? null, utm_campaign: utm_campaign ?? null }))
      .select().single()

    if (error) throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    return data
  },
  { requireBody: true }
)