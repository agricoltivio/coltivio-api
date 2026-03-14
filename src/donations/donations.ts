import Stripe from "stripe";
import { RlsDb } from "../db/db";
import { getStripe } from "../stripe/stripe";
import { donations } from "../db/schema";

export function donationsApi(db: RlsDb) {
  return {
    async createDonationCheckout(
      amount: number,
      email: string,
      successUrl: string,
      cancelUrl: string,
      userId?: string,
    ): Promise<{ url: string }> {
      if (amount < 100) throw new Error("Minimum donation amount is CHF 1.00 (100 cents)");

      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: "chf",
              unit_amount: amount,
              product_data: { name: "Spende an Coltivio" },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: "donation",
          userId: userId ?? "",
        },
      });

      return { url: session.url! };
    },

    async handleDonationWebhook(session: Stripe.Checkout.Session): Promise<void> {
      const userId = session.metadata?.userId || null;
      const email = session.customer_email ?? session.customer_details?.email ?? "";
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? session.id);

      await db.admin
        .insert(donations)
        .values({
          userId: userId || null,
          email,
          stripePaymentId: paymentIntentId,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? "chf",
          status: "succeeded",
        })
        .onConflictDoNothing();
    },
  };
}
