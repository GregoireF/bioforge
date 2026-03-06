import type { APIRoute } from "astro";
import Stripe from "stripe";

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {

    const { customerId, priceId } = await request.json();

    if (!customerId || !priceId) {
      return new Response(
        JSON.stringify({ error: "Missing params" }),
        { status: 400 }
      );
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],

      payment_behavior: "default_incomplete",

      payment_settings: {
        save_default_payment_method: "on_subscription"
      },

      expand: ["latest_invoice.payment_intent"]
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice | null;

    const paymentIntent =
      invoice?.payment_intent as Stripe.PaymentIntent | null;

    const clientSecret = paymentIntent?.client_secret;

    if (!clientSecret) {
      console.error(
        "[create-subscription] Impossible de récupérer le client_secret"
      );

      return new Response(
        JSON.stringify({ error: "No client secret" }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        subscriptionId: subscription.id,
        clientSecret
      }),
      { status: 200 }
    );

  } catch (error) {

    console.error("[create-subscription] Error:", error);

    return new Response(
      JSON.stringify({ error: "Stripe error" }),
      { status: 500 }
    );
  }
};