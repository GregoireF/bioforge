// src/pages/api/feedback.ts
import type { APIRoute }        from 'astro'
import { supabaseAdmin }        from '@/lib/infra/supabase/admin'
import { createSupabaseServer } from '@/lib/infra/supabase/server'
import { feedbackSchema }       from '@/lib/schemas'
import { json }                 from '@/lib/core/http'

export const POST: APIRoute = async (context) => {
  const { request } = context
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  let body: unknown
  try { body = await request.json() }
  catch { return json({ success: false, error: 'Invalid JSON' }, 400) }

  const parsed = feedbackSchema.safeParse(body)
  if (!parsed.success)
    return json({ success: false, error: 'Validation error', issues: parsed.error.flatten().fieldErrors }, 400)

  let userId: string | null = null
  try {
    const supabase = createSupabaseServer(context)
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* feedback anonyme */ }

  const { error } = await supabaseAdmin.from('feedback').insert({
    score:   parsed.data.score,
    comment: parsed.data.comment ?? null,
    source:  parsed.data.source  ?? 'unknown',
    url:     parsed.data.url     ?? null,
    user_id: userId,
  })

  if (error) console.error('[feedback] insert error:', error.message)
  return json({ success: true, data: { received: true } })
}