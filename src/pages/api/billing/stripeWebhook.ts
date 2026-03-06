// src/pages/api/billing/stripeWebhook.ts

import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const POST: APIRoute = async ({ request }) => {

  const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY
  const STRIPE_WEBHOOK_SECRET = import.meta.env.STRIPE_WEBHOOK_SECRET

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {

    console.error('[webhook] variables Stripe manquantes')

    return new Response('Webhook non configuré', { status: 500 })

  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event

  try {

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    )

  } catch (err: any) {

    console.error('[webhook] Signature invalide:', err.message)

    return new Response('Invalid signature', { status: 400 })

  }

  try {

    switch (event.type) {

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {

        const sub = event.data.object as Stripe.Subscription

        const priceId = sub.items.data[0]?.price?.id ?? null
        const profileId = sub.metadata?.profile_id ?? null

        if (!profileId) break

        const plan =
          priceId === import.meta.env.STRIPE_PRICE_CREATOR ? 'Creator' :
          priceId === import.meta.env.STRIPE_PRICE_PRO ? 'Pro' :
          priceId === import.meta.env.STRIPE_PRICE_ENTERPRISE ? 'Enterprise' :
          'Free'

        const isActive = ['active', 'trialing'].includes(sub.status)

        await supabase.from('subscriptions').upsert({

          id: sub.id,
          profile_id: profileId,
          customer_id: sub.customer as string,
          price_id: priceId,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()

        }, { onConflict: 'id' })

        await supabase.from('profiles').update({

          plan: isActive ? plan : 'Free',
          subscription_status: sub.status,
          plan_expires_at: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()

        }).eq('id', profileId)

        break

      }

      case 'invoice.payment_failed': {

        const invoice = event.data.object as Stripe.Invoice

        if (invoice.subscription) {

          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.subscription)

        }

        break
      }

      default:
        break

    }

  }

  catch (err: any) {

    console.error('[webhook] processing error', err)

    return new Response('Webhook error', { status: 500 })

  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })

}

export const config = {
  api: { bodyParser: false }
}