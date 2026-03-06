// src/pages/api/cancel-subscription.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/auth';
import Stripe from 'stripe';

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

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Trouve la subscription active ─────────────────────────────────────────
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('profile_id', profile.id)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    return new Response(
      JSON.stringify({ error: 'Aucun abonnement actif trouvé.' }),
      { status: 404 }
    );
  }

  try {
    const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

    // cancel_at_period_end = true → l'user garde l'accès jusqu'à la fin
    const updated = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    });

    // Mise à jour locale immédiate (le webhook fera la synchro complète)
    await supabase
      .from('subscriptions')
      .update({
        cancel_at:  updated.cancel_at
          ? new Date(updated.cancel_at * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    return new Response(
      JSON.stringify({
        ok:        true,
        cancelAt:  updated.cancel_at
          ? new Date(updated.cancel_at * 1000).toISOString()
          : null,
      }),
      { status: 200 }
    );

  } catch (err: any) {
    console.error('[cancel-subscription]', err.message);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Erreur serveur' }),
      { status: 500 }
    );
  }
};