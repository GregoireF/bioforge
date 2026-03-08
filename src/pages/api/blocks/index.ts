// src/pages/api/blocks/index.ts
import type { APIRoute } from 'astro'
import { requireUser } from '@/lib/auth/require-user'
import { verifyContentType } from '@/lib/security/headers'
import { verifyCSRF } from '@/lib/security/csrf'
import { success, error } from '@/lib/core/http'
import { z } from 'zod'
import { getBlocks, createBlock } from '@/lib/db/queries.server'
import type { BlockInsert } from '@/lib/db/queries.server'

// FIX 1 : title est optionnel/nullable — spacer, image, video n'en ont pas forcément.
// FIX 2 : on retire le .min(1) qui rejetait les titres vides envoyés comme "".
const createBlockSchema = z.object({
  type:   z.enum(['link', 'heading', 'spacer', 'image', 'video', 'social']),
  title:  z.string().max(100).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
}).strip()

// ==================== GET ====================

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context)
  if ('error' in auth) return error(auth.error, 401)

  const { data, error: dbError } = await getBlocks(
    auth.supabase,
    auth.user.id
  )

  if (dbError) return error('BLOCKS_FETCH_FAILED', 500)

  return success(data)
}

// ==================== POST ====================

export const POST: APIRoute = async (context) => {
  const { request } = context

  if (!verifyContentType(request))
    return error('INVALID_CONTENT_TYPE', 415)

  // FIX 3 : CSRF désactivé pour les appels API internes (fetch depuis le dashboard).
  // verifyCSRF est conçu pour les <form> HTML — les fetch() JSON n'envoient pas de cookie CSRF.
  // Si tu veux le garder, il faut envoyer le token depuis blocks.astro (voir commentaire bas de fichier).
  //
  // Option A (recommandé) : désactiver CSRF sur cette route, la protection vient du
  // Content-Type: application/json lui-même (pas forgeable par un form cross-origin).
  //
  // Option B : garder verifyCSRF et l'activer seulement si le header X-CSRF-Token est absent
  // pour ne pas casser les appels fetch qui ne l'envoient pas encore.
  //
  // On choisit l'Option A ici :
  // if (!verifyCSRF(request)) return error('CSRF_FAILED', 403)

  const auth = await requireUser(context)
  if ('error' in auth) return error(auth.error, 401)

  const profileId = auth.user.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error('INVALID_JSON', 400)
  }

  const parsed = createBlockSchema.safeParse(body)
  if (!parsed.success)
    return error('VALIDATION_ERROR', 400, parsed.error.flatten())

  // FIX 1 : title peut être null (spacer, image sans légende…)
  const blockInsert: BlockInsert = {
    profile_id: profileId,
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