// src/pages/api/roadmap-vote.ts
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
  let itemId: string, action: 'vote' | 'unvote';
  try {
    const body = await request.json();
    itemId = body.itemId;
    action = body.action;
    if (!itemId || !['vote', 'unvote'].includes(action)) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Vote / Unvote ─────────────────────────────────────────────────────────
  // Le trigger _sync_roadmap_vote_count() gère vote_count automatiquement
  if (action === 'vote') {
    const { error } = await supabase
      .from('roadmap_votes')
      .upsert(
        { profile_id: profile.id, item_id: itemId },
        { onConflict: 'profile_id,item_id', ignoreDuplicates: true }
      );
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  } else {
    const { error } = await supabase
      .from('roadmap_votes')
      .delete()
      .eq('profile_id', profile.id)
      .eq('item_id', itemId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // ── Retourne le vote_count réel depuis la DB ───────────────────────────────
  // Le client l'utilise pour rester en sync (évite la dérive optimiste)
  const { data } = await supabase
    .from('roadmap_items')
    .select('vote_count')
    .eq('id', itemId)
    .single();

  return new Response(
    JSON.stringify({ ok: true, vote_count: data?.vote_count ?? null }),
    { status: 200 }
  );
};