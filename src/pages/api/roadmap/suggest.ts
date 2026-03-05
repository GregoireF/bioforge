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
  let title: string, description: string, category: string;
  try {
    const body = await request.json();
    title       = (body.title       ?? '').trim().slice(0, 80);
    description = (body.description ?? '').trim().slice(0, 400);
    category    = (body.category    ?? '').trim().slice(0, 50);
    if (!title) throw new Error('title required');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  // ── Rate limit simple : max 3 suggestions par user par 24h ────────────────
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('roadmap_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .gte('created_at', since);

  if ((count ?? 0) >= 3) {
    return new Response(
      JSON.stringify({ error: 'Limite de 3 suggestions par 24h atteinte.' }),
      { status: 429 }
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { error } = await supabase
    .from('roadmap_suggestions')
    .insert({
      user_id:     profile.id,
      username:    profile.username ?? null,
      title,
      description: description || null,
      category:    category    || null,
      status:      'pending',   // pending | reviewed | added | rejected
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 201 });
};