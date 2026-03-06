import type { APIRoute } from "astro";
import Stripe from "stripe";

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get("stripe-signature");

  if (!sig || !endpointSecret) {
    return new Response("Webhook secret missing", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      endpointSecret
    );
  } catch (err) {
    console.error("[webhook] Signature invalide:", err);

    return new Response("Webhook Error", { status: 400 });
  }

  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        console.log("Paiement réussi pour:", invoice.customer);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        console.log("Abonnement annulé:", subscription.id);

        break;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[webhook error]", error);

    return new Response("Webhook handler failed", { status: 500 });
  }
};