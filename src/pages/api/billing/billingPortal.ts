import type { APIRoute } from 'astro';
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

  if (!profile.stripe_customer_id) {
    return new Response(
      JSON.stringify({ error: 'Aucun compte Stripe associé à ce profil.' }),
      { status: 400 }
    );
  }

  try {
    const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

    const session = await stripe.billingPortal.sessions.create({
      customer:   profile.stripe_customer_id,
      return_url: `${import.meta.env.PUBLIC_SITE_URL}/dashboard/billing`,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });

  } catch (err: any) {
    console.error('[billing-portal]', err.message);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Erreur serveur' }),
      { status: 500 }
    );
  }
};