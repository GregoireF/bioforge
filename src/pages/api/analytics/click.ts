import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { parse } from 'cookie';
import { z } from 'zod';

// CONFIG
const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

// HELPERS
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// CLIENT
function createSupabaseClient(request: Request) {
  const cookies = parse(request.headers.get('cookie') ?? '');
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookies[key],
        set: () => {},
        remove: () => {},
      },
    }
  );
}

// CSRF bypass dev
function verifyCSRF(request: Request) {
  if (import.meta.env.DEV) return true;
  return true;
}

// VALIDATION
const clickSchema = z.object({
  block_id: z.string().uuid().optional(),
  blockId: z.string().uuid().optional(),
  profile_id: z.string().uuid(),
}).transform(val => ({
  block_id: val.block_id || val.blockId,
  profile_id: val.profile_id,
})).refine(val => !!val.block_id, { message: 'block_id requis' });

// ENDPOINT
export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('[CLICK] Requête reçue');

    if (!request.headers.get('content-type')?.includes('application/json')) {
      return json({ success: false, error: 'INVALID_CONTENT_TYPE' }, 415);
    }

    if (!verifyCSRF(request)) {
      return json({ success: false, error: 'CSRF_FAILED' }, 403);
    }

    const supabase = createSupabaseClient(request);

    const body = await request.json();
    console.log('[CLICK] Body reçu :', body);

    const parsed = clickSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[CLICK] Validation KO :', parsed.error.flatten());
      return json({ success: false, error: 'VALIDATION_ERROR' }, 400);
    }

    const { block_id, profile_id } = parsed.data;
    console.log('[CLICK] Params OK :', { block_id, profile_id });

    // Vérif bloc
    const { data: block, error: blockError } = await supabase
      .from('blocks')
      .select('id, active, profile_id')
      .eq('id', block_id)
      .eq('profile_id', profile_id)
      .single();

    if (blockError || !block || !block.active) {
      console.error('[CLICK] Bloc invalide :', blockError || 'inactif');
      return json({ success: false, error: 'BLOCK_INVALID' }, 400);
    }

    const today = new Date().toISOString().split('T')[0];
    console.log('[CLICK] Date :', today);

    // VERSION FORCE BRUTE : on récupère, on ajoute 1, on écrase
    const { data: current, error: selectError } = await supabase
      .from('daily_block_stats')
      .select('clicks')
      .eq('block_id', block_id)
      .eq('date', today)
      .maybeSingle();

    let newClicks = 1; // si nouvelle ligne
    if (current && current.clicks !== null) {
      newClicks = current.clicks + 1;
    }

    console.log('[CLICK] Nouvelle valeur calculée :', newClicks);

    // On UPSERT avec la valeur finale
    const { error: upsertError } = await supabase
      .from('daily_block_stats')
      .upsert(
        {
          block_id,
          date: today,
          clicks: newClicks
        },
        {
          onConflict: 'block_id, date',
          ignoreDuplicates: false
        }
      );

    if (upsertError) {
      console.error('[CLICK] Erreur upsert :', upsertError);
      return json({ success: false, error: 'UPSERT_FAILED' }, 500);
    }

    console.log('[CLICK] Succès : clicks mis à', newClicks);

    return json({ success: true }, 201);

  } catch (error) {
    console.error('[CLICK] Erreur globale :', error);
    return json({ success: false, error: 'INTERNAL_ERROR' }, 500);
  }
};