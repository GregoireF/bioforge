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
    if (!priceId || typeof priceId !== 'string') throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: 'priceId manquant' }), { status: 400 });
  }

  // ── Vérifie que les vars d'env sont définies ───────────────────────────────
  if (!import.meta.env.STRIPE_SECRET_KEY) {
    console.error('[create-subscription] STRIPE_SECRET_KEY non définie');
    return new Response(JSON.stringify({ error: 'Configuration Stripe manquante' }), { status: 500 });
  }

  const stripe   = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // ── 1. Récupère ou crée le Customer Stripe ─────────────────────────────
    let customerId = profile.stripe_customer_id ?? null;

    if (!customerId) {
      // Vérifie d'abord si un customer Stripe existe déjà pour cet email
      if (profile.email) {
        const existing = await stripe.customers.list({ email: profile.email, limit: 1 });
        if (existing.data.length > 0) customerId = existing.data[0].id;
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email:    profile.email ?? undefined,
          name:     profile.display_name ?? profile.username ?? undefined,
          metadata: { profile_id: profile.id, username: profile.username ?? '' },
        });
        customerId = customer.id;
      }

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id);
    }

    // ── 2. Annule les subscriptions incomplètes précédentes ────────────────
    // (évite d'accumuler des PaymentIntents orphelins)
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status:   'incomplete',
    });
    for (const s of existingSubs.data) {
      await stripe.subscriptions.cancel(s.id);
    }

    // ── 3. Crée la subscription ────────────────────────────────────────────
    const subscription = await stripe.subscriptions.create({
      customer:         customerId,
      items:            [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: [
        'latest_invoice.payment_intent',
        'latest_invoice.payment_intent.payment_method',
        'pending_setup_intent',
      ],
      metadata: { profile_id: profile.id },
    });

    // ── 4. Récupère le client_secret ───────────────────────────────────────
    // Cas 1 : paiement immédiat → PaymentIntent sur la dernière invoice
    const invoice       = subscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null;

    // Cas 2 : pas de paiement immédiat (trial, montant 0) → SetupIntent
    const setupIntent   = subscription.pending_setup_intent as Stripe.SetupIntent | null;

    const clientSecret  = paymentIntent?.client_secret ?? setupIntent?.client_secret ?? null;

    // Log détaillé pour debug
    console.log('[create-subscription] sub.status:', subscription.status);
    console.log('[create-subscription] invoice:', invoice?.id ?? 'null', '| invoice.status:', (invoice as any)?.status ?? 'null');
    console.log('[create-subscription] PI:', paymentIntent?.id ?? 'null', '| PI.status:', paymentIntent?.status ?? 'null');
    console.log('[create-subscription] SI:', setupIntent?.id ?? 'null');
    console.log('[create-subscription] clientSecret present:', !!clientSecret);

    if (!clientSecret) {
      // Cas : subscription déjà active (customer avec PM enregistré)
      if (subscription.status === 'active') {
        return new Response(
          JSON.stringify({ subscriptionId: subscription.id, alreadyActive: true }),
          { status: 200 }
        );
      }
      throw new Error(
        `Pas de client_secret — status: ${subscription.status}, ` +
        `invoice: ${invoice?.id ?? 'null'} (${(invoice as any)?.status ?? '?'}), ` +
        `PI: ${paymentIntent?.id ?? 'null'} (${paymentIntent?.status ?? '?'}), ` +
        `SI: ${setupIntent?.id ?? 'null'}`
      );
    }

    return new Response(
      JSON.stringify({ clientSecret, subscriptionId: subscription.id }),
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