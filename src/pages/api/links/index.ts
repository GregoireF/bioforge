// src/pages/api/links/index.ts
// GET  — liste les short links du profil
// POST — crée un short link (link_shortener feature)
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { dbPayload } from '@/lib/db'
import { z }                      from 'zod'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomCode(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len).padStart(len, '0')
}

const CODE_RE = /^[a-z0-9_-]{1,20}$/

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createLinkSchema = z.object({
  destination:  z.string().url({ message: 'URL de destination invalide' }).max(2000),
  code:         z.string().regex(CODE_RE, 'Code invalide (a-z0-9_- max 20 chars)').optional(),
  title:        z.string().max(100).nullable().optional(),
  expires_at:   z.string().datetime().nullable().optional(),
  utm_source:   z.string().max(100).nullable().optional(),
  utm_medium:   z.string().max(100).nullable().optional(),
  utm_campaign: z.string().max(100).nullable().optional(),
}).strict()

type CreateLinkBody = z.infer<typeof createLinkSchema>

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET: APIRoute = wrapApiHandler(
  async ({ profile }: ApiHandlerContext) => {
    const { data, error } = await supabaseAdmin
      .from('short_links')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })

    if (error)
      throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    return data ?? []
  }
)

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST: APIRoute = wrapApiHandler<CreateLinkBody>(
  async ({ profile, planLimits, body }: ApiHandlerContext<CreateLinkBody>) => {
    // Feature gating — link_shortener flag depuis plan_limits
    if (!planLimits?.link_shortener)
      throw new AppError({ message: 'Plan Creator requis pour le link shortener', code: ErrorCode.FORBIDDEN, statusCode: 403 })

    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = createLinkSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400,
        meta: parsed.error.flatten() })

    const { destination, code, title, expires_at, utm_source, utm_medium, utm_campaign } = parsed.data

    // Génération ou validation du code
    const finalCode = code
      ? code.toLowerCase()
      : randomCode(6)

    // Unicité du code
    const { data: existing } = await supabaseAdmin
      .from('short_links')
      .select('id')
      .eq('code', finalCode)
      .maybeSingle()

    if (existing)
      throw new AppError({ message: `Le code "${finalCode}" est déjà pris`, code: ErrorCode.CONFLICT, statusCode: 409 })

    // Limite plan (short_links_count depuis plan_limits)
    const limit = planLimits?.short_links_count ?? null
    if (limit !== null) {
      const { count } = await supabaseAdmin
        .from('short_links')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profile.id)
        .eq('is_active', true)

      if ((count ?? 0) >= limit)
        throw new AppError({ message: `Limite de ${limit} liens atteinte`, code: ErrorCode.FORBIDDEN, statusCode: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('short_links')
      .insert(dbPayload({
        profile_id:   profile.id,
        code:         finalCode,
        destination,
        title:        title ?? null,
        expires_at:   expires_at ?? null,
        utm_source:   utm_source ?? null,
        utm_medium:   utm_medium ?? null,
        utm_campaign: utm_campaign ?? null,
      }))
      .select()
      .single()

    if (error)
      throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    return data
  },
  { requireBody: true }
)