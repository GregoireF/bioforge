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

  // ── Supabase ──────────────────────────────────────────────────────────────
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (action === 'vote') {
    // Upsert — idempotent si déjà voté
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

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};