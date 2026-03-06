// src/pages/api/create-subscription.ts
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

  // ── Body ──────────────────────────────────────────────────────────────────
  let priceId: string;
  try {
    const body = await request.json();
    priceId = body.priceId;
    if (!priceId) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: 'priceId manquant' }), { status: 400 });
  }

  const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // ── 1. Récupère ou crée le Customer Stripe ────────────────────────────
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    profile.email ?? undefined,
        name:     profile.display_name ?? profile.username ?? undefined,
        metadata: { profile_id: profile.id, username: profile.username ?? '' },
      });
      customerId = customer.id;

      // Persiste le customer_id dans profiles
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id);
    }

    // ── 2. Annule l'éventuelle subscription active ────────────────────────
    // (évite d'avoir 2 subs en parallèle)
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('profile_id', profile.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (existingSub) {
      await stripe.subscriptions.cancel(existingSub.id);
    }

    // ── 3. Crée la subscription avec payment_behavior = default_incomplete ─
    // Cela génère un PaymentIntent qu'on peut confirmer côté client
    const subscription = await stripe.subscriptions.create({
      customer:         customerId,
      items:            [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand:           ['latest_invoice.payment_intent'],
      metadata:         { profile_id: profile.id },
    });

    const invoice       = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent   as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      throw new Error('Impossible de récupérer le client_secret');
    }

    return new Response(
      JSON.stringify({
        clientSecret:   paymentIntent.client_secret,
        subscriptionId: subscription.id,
      }),
      { status: 200 }
    );

  } catch (err: any) {
    console.error('[create-subscription]', err.message);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Erreur serveur' }),
      { status: 500 }
    );
  }
};