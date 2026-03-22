import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { toJson }                 from '@/lib/db'

// ─── Types body ───────────────────────────────────────────────────────────────
interface StandardToggleBody {
  custom:  false
  slug:    string
  enabled: boolean
}

interface CustomCauseBody {
  custom:   true
  label:    string
  link?:    string
  color?:   string
  enabled?: boolean
}

type CauseBannerBody = StandardToggleBody | CustomCauseBody

// ─── Sanitize ─────────────────────────────────────────────────────────────────
function sanitizeHex(v: unknown, fb: string): string {
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : fb
}

function sanitizeSlug(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, 60)
  return /^[a-z0-9-]{1,60}$/.test(s) ? s : null
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export const GET: APIRoute = wrapApiHandler(
  async ({ profile }: ApiHandlerContext) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('cause_banners, custom_causes')
      .eq('id', profile.id)
      .single()

    if (error)
      throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    return {
      cause_banners: data?.cause_banners ?? [],
      custom_causes: data?.custom_causes ?? [],
    }
  }
)

// ─── POST ─────────────────────────────────────────────────────────────────────
export const POST: APIRoute = wrapApiHandler<CauseBannerBody>(
  async ({ profile, body }: ApiHandlerContext<CauseBannerBody>) => {
    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const { data: current, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('cause_banners, custom_causes')
      .eq('id', profile.id)
      .single()

    if (fetchError)
      throw new AppError({ message: fetchError.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    const currentBanners = (current?.cause_banners ?? []) as string[]
    const currentCustom  = (current?.custom_causes  ?? []) as Record<string, unknown>[]

    // ── Standard toggle ───────────────────────────────────────────────────────
    if (!body.custom) {
      const slug = sanitizeSlug(body.slug)
      if (!slug)
        throw new AppError({ message: 'Slug invalide', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

      const newBanners = body.enabled
        ? [...new Set([...currentBanners, slug])]
        : currentBanners.filter(s => s !== slug)

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ cause_banners: newBanners })
        .eq('id', profile.id)

      if (error)
        throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

      return { cause_banners: newBanners, custom_causes: currentCustom }
    }

    // ── Custom cause ──────────────────────────────────────────────────────────
    if (!body.label?.trim())
      throw new AppError({ message: 'label requis', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    if (currentCustom.length >= 3 && body.enabled !== false)
      throw new AppError({ message: 'Maximum 3 causes personnalisées', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const newCustom = body.enabled === false
      ? currentCustom.filter(c => c.label !== body.label)
      : [...currentCustom, {
          label: body.label.trim().slice(0, 40),
          link:  typeof body.link === 'string' ? body.link.trim().slice(0, 200) || null : null,
          color: sanitizeHex(body.color, '#ffffff'),
          icon:  '🎗️',
        }]

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ custom_causes: toJson(newCustom) })
      .eq('id', profile.id)

    if (error)
      throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    return { cause_banners: currentBanners, custom_causes: newCustom }
  },
  { requireBody: true }
)

// ─── DELETE ───────────────────────────────────────────────────────────────────
export const DELETE: APIRoute = wrapApiHandler(
  async ({ profile, context }: ApiHandlerContext) => {
    const slug = sanitizeSlug(new URL(context.request.url).searchParams.get('slug'))
    if (!slug)
      throw new AppError({ message: 'Slug invalide', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const { data: current, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('cause_banners')
      .eq('id', profile.id)
      .single()

    if (fetchError)
      throw new AppError({ message: fetchError.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    const newBanners = ((current?.cause_banners ?? []) as string[]).filter(s => s !== slug)

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ cause_banners: newBanners })
      .eq('id', profile.id)

    if (error)
      throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })

    return { cause_banners: newBanners }
  }
)