import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { dbPayload, toJson }      from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────
interface OnboardingFeedback {
  usages?:  unknown[]
  source?:  unknown
  nps?:     unknown
  comment?: unknown
}

interface OnboardingBody {
  username:     string
  display_name?: string
  bio?:          string
  preset?:       string
  feedback?:     OnboardingFeedback
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const USERNAME_RE   = /^[a-z0-9_]{3,24}$/
const VALID_USAGES  = new Set(['creator','dev','brand','artist','freelance','other'])
const VALID_SOURCES = new Set(['social','friend','search','product_hunt','ad','other'])

const PRESET_THEMES: Record<string, Record<string, unknown>> = {
  dark:    { preset:'dark',    background_color:'#0a0a0a', primary_color:'#00ff9d', text_color:'#ffffff', gradient_color_2:'#0f1f15' },
  neon:    { preset:'neon',    background_color:'#1a0033', primary_color:'#bf00ff', text_color:'#ffffff', gradient_color_2:'#0d001a' },
  ocean:   { preset:'ocean',   background_color:'#001a33', primary_color:'#00d4ff', text_color:'#ffffff', gradient_color_2:'#002244' },
  light:   { preset:'light',   background_color:'#f8f8f8', primary_color:'#0066ff', text_color:'#0a0a0a', gradient_color_2:'#e8f0ff' },
}

// ─── Route ────────────────────────────────────────────────────────────────────
export const POST: APIRoute = wrapApiHandler<OnboardingBody>(
  async ({ profile, body }: ApiHandlerContext<OnboardingBody>) => {
    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const { username, display_name, bio, preset, feedback } = body

    if (typeof username !== 'string' || !USERNAME_RE.test(username.toLowerCase()))
      throw new AppError({ message: 'Pseudo invalide (3-24 chars, lettres minuscules, chiffres, _)', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const slug = username.toLowerCase().trim()

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', slug)
      .neq('id', profile.id)
      .maybeSingle()

    if (existing)
      throw new AppError({ message: 'Ce pseudo est déjà pris', code: ErrorCode.CONFLICT, statusCode: 409 })

    const baseTheme = (typeof preset === 'string' && PRESET_THEMES[preset]) ? PRESET_THEMES[preset] : PRESET_THEMES.dark
    const theme = {
      ...baseTheme,
      button_style: 'filled', border_radius: 14, font_family: 'Exo 2',
      avatar_shape: 'circle', avatar_border: 'glow', animations: true,
      animation_preset: 'fade', spacing: 'normal', block_shadow: true,
    }

    const cleanFeedback = feedback && typeof feedback === 'object' ? {
      usages:  Array.isArray(feedback.usages)
        ? feedback.usages.filter((u): u is string => typeof u === 'string' && VALID_USAGES.has(u)).slice(0, 6)
        : [],
      source:  typeof feedback.source === 'string' && VALID_SOURCES.has(feedback.source) ? feedback.source : null,
      nps:     typeof feedback.nps === 'number' && feedback.nps >= 0 && feedback.nps <= 10 ? Math.round(feedback.nps) : null,
      comment: typeof feedback.comment === 'string' ? feedback.comment.trim().slice(0, 500) || null : null,
    } : null

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(dbPayload({
        username:                slug,
        display_name:            typeof display_name === 'string' ? display_name.trim().slice(0, 80) || slug : slug,
        bio:                     typeof bio === 'string' ? bio.trim().slice(0, 320) || null : null,
        theme:                   toJson(theme),
        onboarding_feedback:     toJson(cleanFeedback),
        onboarding_completed_at: new Date().toISOString(),
        updated_at:              new Date().toISOString(),
      }))
      .eq('id', profile.id)
      .select('id, username, display_name')
      .single()

    if (error) {
      if (error.code === '23505')
        throw new AppError({ message: 'Ce pseudo est déjà pris', code: ErrorCode.CONFLICT, statusCode: 409 })
      throw new AppError({ message: error.message, code: ErrorCode.DB_ERROR, statusCode: 500 })
    }

    return data
  },
  { requireBody: true }
)