// src/pages/api/blocks/index.ts
import type { APIRoute } from 'astro'
import { requireUser } from '@/lib/auth/require-user'
import { verifyContentType } from '@/lib/security/headers'
import { success, error } from '@/lib/core/http'
import { z } from 'zod'
import { getBlocks, createBlock } from '@/lib/db/queries.server'
import type { BlockInsert } from '@/lib/db/queries.server'

// ── Enum central — à maintenir en sync avec blocks.astro et [username].astro ──
const BLOCK_TYPES = [
  'link', 'heading', 'spacer', 'image', 'video', 'social',
  'countdown', 'schedule', 'donation', 'embed',
  // Nouveaux blocks v2
  'text', 'banner', 'product', 'poll', 'twitch_live',
  'newsletter', 'vcard', 'merch_grid',
] as const

// title : optionnel/nullable — spacer, countdown, twitch_live n'en ont pas forcément.
const createBlockSchema = z.object({
  type:   z.enum(BLOCK_TYPES),
  title:  z.string().max(100).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
}).strip()

// ==================== GET ====================

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context)
  if ('error' in auth) return error(auth.error, 401)

  const { data, error: dbError } = await getBlocks(auth.supabase, auth.user.id)
  if (dbError) return error('BLOCKS_FETCH_FAILED', 500)

  return success(data)
}

// ==================== POST ====================

export const POST: APIRoute = async (context) => {
  const { request } = context

  if (!verifyContentType(request))
    return error('INVALID_CONTENT_TYPE', 415)

  // CSRF désactivé sur cette route :
  // La protection vient de Content-Type: application/json,
  // non forgeable par un <form> cross-origin.
  // if (!verifyCSRF(request)) return error('CSRF_FAILED', 403)

  const auth = await requireUser(context)
  if ('error' in auth) return error(auth.error, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error('INVALID_JSON', 400)
  }

  const parsed = createBlockSchema.safeParse(body)
  if (!parsed.success)
    return error('VALIDATION_ERROR', 400, parsed.error.flatten())

  const blockInsert: BlockInsert = {
    profile_id: auth.user.id,
    type:       parsed.data.type,
    title:      parsed.data.title ?? null,
    config:     parsed.data.config ?? {},
    active:     parsed.data.active ?? true,
    deleted_at: null,
  }

  const { data, error: dbError } = await createBlock(auth.supabase, blockInsert)
  if (dbError)
    return error('CREATE_FAILED', 500, dbError.message || 'Database error')

  return success(data, 201)
}