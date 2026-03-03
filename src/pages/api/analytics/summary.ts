import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { parse } from 'cookie';
import { z } from 'zod';
import { getAnalyticsSummary } from '@/lib/db/queries.server';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

// ── Validation ─────────────────────────────────────────────────────────────────

const ALLOWED_DAYS = [7, 30, 90] as const;

const querySchema = z.object({
  days: z
    .string()
    .optional()
    .transform(v => parseInt(v ?? '7', 10))
    .pipe(z.number().refine(n => (ALLOWED_DAYS as readonly number[]).includes(n), {
      message: 'days must be 7, 30, or 90',
    })),
});

// ── GET /api/analytics/summary?days=7|30|90 ────────────────────────────────────

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('[ANALYTICS SUMMARY] Requête reçue');

    const supabase = createSupabaseClient(request);

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[ANALYTICS SUMMARY] Auth échouée :', authError);
      return json({ success: false, error: 'UNAUTHORIZED' }, 401);
    }

    // Validate ?days param
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({ days: url.searchParams.get('days') ?? '7' });
    if (!parsed.success) {
      console.error('[ANALYTICS SUMMARY] Validation KO :', parsed.error.flatten());
      return json({ success: false, error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, 400);
    }

    const { days } = parsed.data;
    console.log('[ANALYTICS SUMMARY] days :', days, '| user :', user.id);

    // profile.id === user.id (auth uuid = profile uuid)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[ANALYTICS SUMMARY] Profile introuvable :', profileError);
      return json({ success: false, error: 'PROFILE_NOT_FOUND' }, 404);
    }

    // Check plan — only allow >7d for paid users (plan already fetched above)
    if (days > 7 && profile.plan === 'Free') {
      console.warn('[ANALYTICS SUMMARY] Plan Free → accès refusé pour days >', 7);
      return json({ success: false, error: 'UPGRADE_REQUIRED' }, 403);
    }

    // Reuse exact same function as SSR
    const result = await getAnalyticsSummary(supabase, profile.id, days);

    if (!result.success) {
      console.error('[ANALYTICS SUMMARY] getAnalyticsSummary KO :', result.error);
      return json({ success: false, error: 'FETCH_FAILED' }, 500);
    }

    console.log('[ANALYTICS SUMMARY] Succès → totalViews :', result.data?.summary.totalViews);
    return json(result.data, 200);

  } catch (err) {
    console.error('[ANALYTICS SUMMARY] Erreur globale :', err);
    return json({ success: false, error: 'INTERNAL_ERROR' }, 500);
  }
};