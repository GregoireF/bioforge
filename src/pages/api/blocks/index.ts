import type { APIRoute } from 'astro'
import { requireUser } from '@/lib/auth/require-user'
import { verifyContentType } from '@/lib/security/headers'
import { verifyCSRF } from '@/lib/security/csrf'
import { success, error } from '@/lib/core/http'
import { z } from 'zod'
import { getBlocks, createBlock } from '@/lib/db/queries.server'
import type { BlockInsert } from '@/lib/db/queries.server'

const createBlockSchema = z.object({
  type: z.enum(['link', 'heading', 'spacer', 'image', 'video', 'social']),
  title: z.string().min(1).max(100),
  config: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
}).strip()


// ==================== GET BLOCKS ====================

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

// ==================== CREATE BLOCK ====================

export const POST: APIRoute = async (context) => {
  const { request } = context

  if (!verifyContentType(request))
    return error('INVALID_CONTENT_TYPE', 415)

  if (!verifyCSRF(request))
    return error('CSRF_FAILED', 403)

  const auth = await requireUser(context)
  if ('error' in auth) return error(auth.error, 401)

  const profileId = auth.user.id;
  console.log('[POST BLOCK] Tentative création pour user :', profileId);

  const body = await request.json();
  console.log('[POST BLOCK] Body brut reçu :', body);

  const parsed = createBlockSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[POST BLOCK] Validation échouée :', parsed.error.flatten());
    return error('VALIDATION_ERROR', 400, parsed.error.flatten());
  }

  const blockInsert: BlockInsert = {
    profile_id: profileId,
    type: parsed.data.type,
    title: parsed.data.title,
    config: parsed.data.config,
    active: parsed.data.active ?? true,
    // Ajoute explicitement deleted_at à NULL si ta table a ce champ
    deleted_at: null,
  };

  console.log('[POST BLOCK] Objet à insérer :', blockInsert);

  const { data, error: dbError } = await createBlock(
    auth.supabase,
    blockInsert
  );

  if (dbError) {
    console.error('[POST BLOCK] Erreur complète de createBlock :', dbError);
    return error('CREATE_FAILED', 500, dbError.message || 'Erreur base de données');
  }

  console.log('[POST BLOCK] Bloc créé avec succès, ID :', data?.id);

  return success(data, 201);
};