// src/pages/api/roadmap-suggest.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  let profile: any = null;
  try {
    const auth = await withAuth({ cookies, request });
    if (auth.success && auth.data) profile = auth.data.profile;
  } catch {}

  if (!profile) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  // Parsing séparé de la validation pour donner un message clair
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400 });
  }

  const title       = (body.title       ?? '').trim().slice(0, 80);
  const description = (body.description ?? '').trim().slice(0, 400);
  const category    = (body.category    ?? '').trim().slice(0, 50);

  if (!title) {
    return new Response(JSON.stringify({ error: 'Le titre est requis.' }), { status: 400 });
  }

  // ── Supabase service_role (bypass RLS pour pouvoir lire + insérer) ────────
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Rate limit : max 3 suggestions par 24h ────────────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from('roadmap_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .gte('created_at', since);

  if (countError) {
    console.error('[roadmap-suggest] count error:', countError.message);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), { status: 500 });
  }

  if ((count ?? 0) >= 3) {
    return new Response(
      JSON.stringify({ error: 'Limite de 3 suggestions par 24h atteinte.' }),
      { status: 429 }
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { error: insertError } = await supabase
    .from('roadmap_suggestions')
    .insert({
      profile_id:  profile.id,
      username:    profile.username ?? null,
      title,
      description: description || null,
      category:    category    || null,
      status:      'pending',
    });

  if (insertError) {
    console.error('[roadmap-suggest] insert error:', insertError.message);
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 201 });
};