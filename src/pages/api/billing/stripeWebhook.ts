import type { APIRoute } from "astro";
import Stripe from "stripe";

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {

  const signature = request.headers.get("stripe-signature");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {

    const body = await request.text();

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

  } catch (err) {

    console.error("[webhook] Signature invalide:", err);

    return new Response("Invalid signature", { status: 400 });
  }

  try {

    switch (event.type) {

      case "invoice.payment_succeeded": {

        const invoice = event.data.object as Stripe.Invoice;

        const periodEnd =
          invoice.lines?.data?.[0]?.period?.end;

        const periodEndISO = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null;

        console.log("Paiement réussi:", {
          customer: invoice.customer,
          periodEnd: periodEndISO
        });

        break;
      }

      case "customer.subscription.deleted": {

        const sub = event.data.object as Stripe.Subscription;

        console.log("Subscription cancelled:", sub.id);

        break;
      }

      case "checkout.session.completed": {

        const session = event.data.object as Stripe.Checkout.Session;

        console.log("Checkout completed:", session.id);

        break;
      }
    }

    return new Response("OK", { status: 200 });

  } catch (error) {

    console.error("[webhook] processing error", error);

    return new Response("Webhook error", { status: 500 });
  }
};