// src/pages/api/stripe-webhook.ts
// Webhook Stripe — met à jour subscriptions + profiles.plan en temps réel
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Map Stripe price_id → plan BioForge
const PRICE_TO_PLAN: Record<string, string> = {
  [import.meta.env.STRIPE_PRICE_CREATOR]:    'Creator',
  [import.meta.env.STRIPE_PRICE_PRO]:        'Pro',
  [import.meta.env.STRIPE_PRICE_ENTERPRISE]: 'Enterprise',
};

export const POST: APIRoute = async ({ request }) => {
  const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Vérifie la signature Stripe ───────────────────────────────────────────
  const sig  = request.headers.get('stripe-signature');
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      import.meta.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('[webhook] Signature invalide:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function upsertSubscription(sub: Stripe.Subscription) {
    const priceId    = sub.items.data[0]?.price?.id ?? null;
    const planName   = priceId ? (PRICE_TO_PLAN[priceId] ?? 'Free') : 'Free';
    const profileId  = sub.metadata?.profile_id ?? null;

    if (!profileId) {
      console.warn('[webhook] subscription sans profile_id:', sub.id);
      return;
    }

    // Upsert dans subscriptions
    await supabase.from('subscriptions').upsert({
      id:                   sub.id,
      profile_id:           profileId,
      customer_id:          sub.customer as string,
      price_id:             priceId,
      status:               sub.status,
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
      cancel_at:            sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
      canceled_at:          sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      trial_end:            sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      interval:             sub.items.data[0]?.price?.recurring?.interval ?? null,
      amount:               sub.items.data[0]?.price?.unit_amount ?? null,
      currency:             sub.currency,
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'id' });

    // Met à jour le plan + subscription_status sur profiles
    const isActive = ['active', 'trialing'].includes(sub.status);
    await supabase.from('profiles').update({
      plan:                isActive ? planName : 'Free',
      subscription_status: sub.status,
      plan_expires_at:     new Date(sub.current_period_end * 1000).toISOString(),
      updated_at:          new Date().toISOString(),
    }).eq('id', profileId);
  }

  // ── Dispatch événements ───────────────────────────────────────────────────
  try {
    switch (event.type) {

      // Subscription créée / mise à jour / annulée
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        break;
      }

      // Paiement réussi — s'assure que le plan est bien actif
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await upsertSubscription(sub);
        }
        break;
      }

      // Paiement échoué — passe en past_due
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await supabase.from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', invoice.subscription);

          const profileId = invoice.metadata?.profile_id;
          if (profileId) {
            await supabase.from('profiles')
              .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
              .eq('id', profileId);
          }
        }
        break;
      }

      // Customer supprimé — remet tout à Free
      case 'customer.deleted': {
        const customer = event.data.object as Stripe.Customer;
        await supabase.from('profiles')
          .update({
            stripe_customer_id:  null,
            plan:                'Free',
            subscription_status: 'none',
            plan_expires_at:     null,
            updated_at:          new Date().toISOString(),
          })
          .eq('stripe_customer_id', customer.id);
        break;
      }

      default:
        // Événement non géré — OK, on ignore
        break;
    }
  } catch (err: any) {
    console.error('[webhook] Erreur traitement:', err.message);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};

// Désactive le body parsing d'Astro — Stripe a besoin du raw body pour la signature
export const config = {
  api: { bodyParser: false },
};