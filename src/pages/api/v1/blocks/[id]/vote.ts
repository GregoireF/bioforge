// src/pages/api/blocks/[id]/vote.ts
import type { APIRoute }  from 'astro'
import { supabaseAdmin }  from '@/lib/infra/supabase/admin'
import { voteSchema }     from '@/lib/schemas'
import { json }           from '@/lib/core/http'
import { isValidUUID, toJson } from '@/lib/db'
import { getIP }          from '@/lib/analytics/helpers'
import { checkRateLimit } from '@/lib/security/rate-limit'

export const POST: APIRoute = async ({ params, request }) => {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return new Response(null, { status: 415 })

  const blockId = params.id?.trim() ?? ''
  if (!isValidUUID(blockId)) return json({ success: false, error: 'Invalid block ID' }, 400)

  const ip = getIP(request)
  const ipKey = ip.split('.').slice(0, 3).join('.')
  const { allowed } = await checkRateLimit('analytics_click', ipKey)
  if (!allowed) return json({ success: false, error: 'Too many requests' }, 429)

  let body: unknown
  try { body = await request.json() }
  catch { return json({ success: false, error: 'Invalid JSON' }, 400) }

  const parsed = voteSchema.safeParse(body)
  if (!parsed.success)
    return json({ success: false, error: 'option_index doit être un entier entre 0 et 9' }, 400)

  const { option_index } = parsed.data

  const { data: block, error: fetchErr } = await supabaseAdmin
    .from('blocks').select('id, type, config, active').eq('id', blockId).is('deleted_at', null).single()

  if (fetchErr || !block) return json({ success: false, error: 'Block not found' }, 404)
  if (block.type !== 'poll') return json({ success: false, error: 'Not a poll block' }, 400)
  if (!block.active)         return json({ success: false, error: 'Poll is inactive' }, 400)

  const config  = (block.config ?? {}) as Record<string, unknown>
  const options = Array.isArray(config.options) ? [...(config.options as Record<string, unknown>[])] : []

  if (option_index >= options.length) return json({ success: false, error: 'Index hors limites' }, 400)

  options[option_index] = { ...options[option_index], votes: ((options[option_index].votes as number) ?? 0) + 1 }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('blocks').update({ config: toJson({ ...config, options }) }).eq('id', blockId).select('id, config').single()

  if (updateErr) return json({ success: false, error: updateErr.message }, 500)

  const updatedConfig = (updated?.config ?? {}) as Record<string, unknown>
  return json({ success: true, data: { options: Array.isArray(updatedConfig.options) ? updatedConfig.options : options, voted_index: option_index } })
}