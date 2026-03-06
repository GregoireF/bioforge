import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { withAuth } from '@/lib/auth/auth'

type Expanded<T> = T & Record<string, any>;

export const POST: APIRoute = async ({ request, cookies }) => {

  // ─────────────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────
  // BODY
  // ─────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────
  // ENV CHECK
  // ─────────────────────────────────────────────────────────

  const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY

  if (!STRIPE_SECRET_KEY) {
    console.error('[create-subscription] STRIPE_SECRET_KEY manquant')

    return new Response(
      JSON.stringify({ error: 'Configuration Stripe manquante' }),
      { status: 500 }
    )
  }

  // ─────────────────────────────────────────────────────────
  // CLIENTS
  // ─────────────────────────────────────────────────────────

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {

    // ─────────────────────────────────────────────────────────
    // 1️⃣ CUSTOMER STRIPE
    // ─────────────────────────────────────────────────────────

    let customerId: string | null = profile.stripe_customer_id ?? null

    if (!customerId) {

      // Vérifie si un customer existe déjà
      if (profile.email) {

        const existing = await stripe.customers.list({
          email: profile.email,
          limit: 1
        })

        if (existing.data.length > 0) {
          customerId = existing.data[0].id
        }
      }

      // Sinon on le crée
      if (!customerId) {

        const customer = await stripe.customers.create({
          email: profile.email ?? undefined,
          name: profile.display_name ?? profile.username ?? undefined,
          metadata: {
            profile_id: profile.id,
            username: profile.username ?? ''
          }
        })

        customerId = customer.id
      }

      // Sauvegarde dans Supabase
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id)

    }

    // ─────────────────────────────────────────────────────────
    // 2️⃣ NETTOIE LES SUBSCRIPTIONS INCOMPLETE
    // ─────────────────────────────────────────────────────────

    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'incomplete',
      limit: 10
    })

    for (const sub of existingSubs.data) {
      await stripe.subscriptions.cancel(sub.id)
    }

    // ─────────────────────────────────────────────────────────
    // 3️⃣ CRÉE LA SUBSCRIPTION
    // ─────────────────────────────────────────────────────────

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

    })

    // ─────────────────────────────────────────────────────────
    // 4️⃣ RÉCUPÈRE PAYMENT INTENT
    // ─────────────────────────────────────────────────────────

    const invoice = subscription.latest_invoice as Expanded<Stripe.Invoice>

    let paymentIntent: Stripe.PaymentIntent | null = null

    if (invoice && typeof invoice.payment_intent !== 'string') {
      paymentIntent = invoice.payment_intent
    }

    // ─────────────────────────────────────────────────────────
    // 5️⃣ SETUP INTENT (TRIAL / ZERO AMOUNT)
    // ─────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────
    // DEBUG LOGS
    // ─────────────────────────────────────────────────────────

    console.log('[create-subscription]')
    console.log('sub.status:', subscription.status)
    console.log('invoice:', invoice?.id ?? 'null')
    console.log('PI:', paymentIntent?.id ?? 'null')
    console.log('SI:', setupIntent?.id ?? 'null')
    console.log('clientSecret:', !!clientSecret)

    // ─────────────────────────────────────────────────────────
    // CAS : SUB DÉJÀ ACTIVE
    // ─────────────────────────────────────────────────────────

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

      throw new Error(
        `Pas de client_secret — status: ${subscription.status}`
      )
    }

    // ─────────────────────────────────────────────────────────
    // SUCCESS
    // ─────────────────────────────────────────────────────────

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