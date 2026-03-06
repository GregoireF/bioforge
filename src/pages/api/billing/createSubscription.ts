// src/pages/api/billing/manage-subscription.ts
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/auth';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY ?? '');

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await withAuth({ request, cookies });
  if (!auth.success || !auth.data?.profile) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const profile = auth.data.profile;
  const { priceId } = await request.json();

  if (!priceId) {
    return new Response(JSON.stringify({ error: 'priceId requis' }), { status: 400 });
  }

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL ?? '',
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );

  // 1. Récupérer la subscription actuelle (la plus récente active/incomplète)
  const { data: currentSub } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id, status')
    .eq('profile_id', profile.id)
    .in('status', ['active', 'trialing', 'past_due', 'incomplete', 'incomplete_expired'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let customerId = profile.stripe_customer_id;

  // 2. Créer le customer si inexistant
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.display_name || profile.username || undefined,
      metadata: { profile_id: profile.id },
    });
    customerId = customer.id;

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', profile.id);
  }

  let clientSecret: string | null = null;
  let requiresAction = false;

  if (currentSub?.stripe_subscription_id) {
    // ── UPGRADE ou DOWNGRADE ───────────────────────────────────────────────
    try {
      const subscription = await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id);

      if (!subscription.items.data.length) {
        throw new Error('Aucun item dans la subscription existante');
      }

      const currentItem = subscription.items.data[0];

      // Mise à jour → on remplace le price de l'item existant
      const updatedSub = await stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: currentItem.id, // ← clé : on update l'item existant
            price: priceId,
          },
        ],
        proration_behavior: 'create_prorations', // ou 'always_invoice' si tu veux facturer immédiatement
        // Si tu veux appliquer au prochain cycle seulement → 'none' + schedule change (plus complexe)
      });

      // Récupérer la dernière invoice pour voir si paiement requis (upgrade + proration > 0 ou 3DS)
      if (updatedSub.latest_invoice) {
        const invoice = await stripe.invoices.retrieve(updatedSub.latest_invoice as string, {
          expand: ['payment_intent'],
        });

        if (invoice.payment_intent && typeof invoice.payment_intent !== 'string') {
          clientSecret = invoice.payment_intent.client_secret;
          requiresAction = !!clientSecret && invoice.status === 'open';
        }
      }
    } catch (err: any) {
      console.error('[manage-sub upgrade/downgrade]', err);
      return new Response(JSON.stringify({ error: err.message || 'Erreur Stripe' }), { status: 500 });
    }
  } else {
    // ── NOUVELLE subscription ──────────────────────────────────────────────
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      const paymentIntent = subscription.latest_invoice?.payment_intent as Stripe.PaymentIntent | null;
      clientSecret = paymentIntent?.client_secret ?? null;
      requiresAction = !!clientSecret;
    } catch (err: any) {
      console.error('[manage-sub create]', err);
      return new Response(JSON.stringify({ error: err.message || 'Erreur création' }), { status: 500 });
    }
  }

  return new Response(
    JSON.stringify({
      clientSecret,
      requiresAction,
      message: requiresAction ? 'Paiement requis' : 'Plan mis à jour sans paiement supplémentaire',
    }),
    { status: 200 }
  );
};