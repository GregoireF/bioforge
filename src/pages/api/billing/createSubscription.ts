// src/pages/api/billing/createSubscription.ts

import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { withAuth } from '@/lib/auth/auth'

type Expanded<T> = T & Record<string, any>

export const POST: APIRoute = async ({ request, cookies }) => {

  // ─────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────

  let profile: any = null

  try {
    const auth = await withAuth({ cookies, request })

    if (auth.success && auth.data) {
      profile = auth.data.profile
    }

  } catch {}

  if (!profile) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401 }
    )
  }

  // ─────────────────────────────────────
  // BODY
  // ─────────────────────────────────────

  let priceId: string

  try {

    const body = await request.json()

    priceId = body.priceId

    if (!priceId || typeof priceId !== 'string') {
      throw new Error()
    }

  } catch {

    return new Response(
      JSON.stringify({ error: 'priceId manquant' }),
      { status: 400 }
    )

  }

  // ─────────────────────────────────────
  // ENV
  // ─────────────────────────────────────

  const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY

  if (!STRIPE_SECRET_KEY) {

    console.error('[create-subscription] STRIPE_SECRET_KEY manquant')

    return new Response(
      JSON.stringify({ error: 'Configuration Stripe manquante' }),
      { status: 500 }
    )

  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {

    // ─────────────────────────────────────
    // CUSTOMER
    // ─────────────────────────────────────

    let customerId: string | null = profile.stripe_customer_id ?? null

    if (!customerId) {

      if (profile.email) {

        const existing = await stripe.customers.list({
          email: profile.email,
          limit: 1
        })

        if (existing.data.length > 0) {
          customerId = existing.data[0].id
        }

      }

      if (!customerId) {

        const customer = await stripe.customers.create({
          email: profile.email ?? undefined,
          name: profile.display_name ?? profile.username ?? undefined,
          metadata: {
            profile_id: profile.id
          }
        })

        customerId = customer.id

      }

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id)

    }

    // ─────────────────────────────────────
    // CLEAN INCOMPLETE SUBS
    // ─────────────────────────────────────

    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'incomplete',
      limit: 10
    })

    for (const sub of existingSubs.data) {
      await stripe.subscriptions.cancel(sub.id)
    }

    // ─────────────────────────────────────
    // CREATE SUB
    // ─────────────────────────────────────

    const subscription = await stripe.subscriptions.create({

      customer: customerId,

      items: [
        { price: priceId }
      ],

      payment_behavior: 'default_incomplete',

      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },

      expand: [
        'latest_invoice.payment_intent',
        'pending_setup_intent'
      ],

      metadata: {
        profile_id: profile.id
      }

    }, {

      idempotencyKey: `sub_${profile.id}_${priceId}`

    })

    // ─────────────────────────────────────
    // PAYMENT INTENT
    // ─────────────────────────────────────

    const invoice = subscription.latest_invoice as Expanded<Stripe.Invoice>

    let paymentIntent: Stripe.PaymentIntent | null = null

    if (invoice && typeof invoice.payment_intent !== 'string') {
      paymentIntent = invoice.payment_intent
    }

    // ─────────────────────────────────────
    // SETUP INTENT
    // ─────────────────────────────────────

    let setupIntent: Stripe.SetupIntent | null = null

    if (
      subscription.pending_setup_intent &&
      typeof subscription.pending_setup_intent !== 'string'
    ) {
      setupIntent = subscription.pending_setup_intent
    }

    const clientSecret =
      paymentIntent?.client_secret ??
      setupIntent?.client_secret ??
      null

    // ─────────────────────────────────────
    // DEBUG
    // ─────────────────────────────────────

    console.log('[create-subscription]')
    console.log('status:', subscription.status)
    console.log('invoice:', invoice?.id)
    console.log('paymentIntent:', paymentIntent?.id)
    console.log('setupIntent:', setupIntent?.id)
    console.log('clientSecret:', !!clientSecret)

    // ─────────────────────────────────────
    // ALREADY ACTIVE
    // ─────────────────────────────────────

    if (!clientSecret) {

      if (subscription.status === 'active') {

        return new Response(
          JSON.stringify({
            subscriptionId: subscription.id,
            alreadyActive: true
          }),
          { status: 200 }
        )

      }

      throw new Error('Impossible de récupérer le client_secret')

    }

    return new Response(
      JSON.stringify({
        clientSecret,
        subscriptionId: subscription.id
      }),
      { status: 200 }
    )

  }

  catch (err: any) {

    console.error('[create-subscription]', err)

    return new Response(
      JSON.stringify({
        error: err?.message ?? 'Erreur serveur'
      }),
      { status: 500 }
    )

  }

}