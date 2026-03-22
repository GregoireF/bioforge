// src/pages/api/profile/onboarding.ts
import type { APIRoute }          from 'astro'
import type { ApiHandlerContext } from '@/lib/api/handler'
import { wrapApiHandler }         from '@/lib/api/handler'
import { supabaseAdmin }          from '@/lib/infra/supabase/admin'
import { buildPresetTheme }       from '@/lib/modules/profile/theme'
import { onboardingSchema }       from '@/lib/schemas'
import type { OnboardingInput }   from '@/lib/schemas'
import { AppError, ErrorCode }    from '@/lib/core/errors'
import { dbPayload, toJson }      from '@/lib/db'

export const POST: APIRoute = wrapApiHandler<OnboardingInput>(
  async ({ profile, body }: ApiHandlerContext<OnboardingInput>) => {
    if (!body) throw new AppError({ message: 'Body required', code: ErrorCode.VALIDATION_ERROR, statusCode: 400 })

    const parsed = onboardingSchema.safeParse(body)
    if (!parsed.success)
      throw new AppError({ message: 'Validation error', code: ErrorCode.VALIDATION_ERROR, statusCode: 400, meta: parsed.error.flatten() })

    const { username, display_name, bio, preset, feedback } = parsed.data
    // username déjà lowercased+trimmed par le schema .transform()

    const { data: existing } = await supabaseAdmin
      .from('profiles').select('id').eq('username', username).neq('id', profile.id).maybeSingle()

    if (existing)
      throw new AppError({ message: 'Ce pseudo est déjà pris', code: ErrorCode.CONFLICT, statusCode: 409 })

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(dbPayload({
        username,
        display_name: display_name?.trim().slice(0, 80) || username,
        bio:          bio?.trim().slice(0, 320) || null,
        theme:        toJson(buildPresetTheme(preset)),
        onboarding_feedback:     toJson(feedback ?? null),
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