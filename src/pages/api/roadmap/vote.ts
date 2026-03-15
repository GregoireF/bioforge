// src/pages/api/roadmap-vote.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/auth';

const VOTE_MILESTONES = [10, 25, 50, 100, 250];

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

  // ── Snapshot vote_count AVANT (pour détecter les milestones) ──────────────
  const { data: itemBefore } = await supabase
    .from('roadmap_items')
    .select('vote_count, title')
    .eq('id', itemId)
    .single();

  const countBefore = itemBefore?.vote_count ?? 0;

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

  // ── Retourne le vote_count réel depuis la DB ──────────────────────────────
  // Le client l'utilise pour rester en sync (évite la dérive optimiste)
  const { data } = await supabase
    .from('roadmap_items')
    .select('vote_count')
    .eq('id', itemId)
    .single();

  const countAfter = data?.vote_count ?? countBefore;

  // ── Notif milestone (non bloquant) ────────────────────────────────────────
  // Si un seuil est franchi suite à CE vote, on notifie le votant
  if (action === 'vote' && itemBefore?.title) {
    const milestone = VOTE_MILESTONES.find(m => countBefore < m && countAfter >= m);
    if (milestone) {
      // Fire-and-forget — ne bloque pas la réponse
      supabase.rpc('create_milestone_notif', {
        p_user_id: profile.id,
        p_type:    'click_milestone',
        p_title:   `🔥 "${itemBefore.title}" dépasse les ${milestone} votes`,
        p_body:    `La feature que tu soutiens gagne en popularité — elle pourrait être priorisée prochainement.`,
        p_icon:    '🔥',
        p_href:    '/dashboard/roadmap',
      }).then().catch(() => {/* silent */});
    }
  }

  return new Response(
    JSON.stringify({ ok: true, vote_count: countAfter }),
    { status: 200 }
  );
};