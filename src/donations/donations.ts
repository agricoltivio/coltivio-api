import Stripe from "stripe";
import { RlsDb } from "../db/db";
import { getStripe } from "../stripe/stripe";
import { donations } from "../db/schema";
import { sendDonationConfirmationEmail } from "./donations.email";

export function donationsApi(db: RlsDb) {
  return {
    async createDonationCheckout(
      amount: number,
      email: string,
      successUrl: string,
      cancelUrl: string,
      userId?: string,
      locale?: string
    ): Promise<{ url: string }> {
      if (amount < 100) throw new Error("Minimum donation amount is CHF 1.00 (100 cents)");

      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card", "twint"],
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
          locale: locale ?? "de",
        },
      });

      return { url: session.url! };
    },

    // Native PaymentSheet equivalent of createDonationCheckout — no Stripe Customer/ephemeral key
    // needed since donations don't save a payment method or support guest re-use.
    async createDonationIntent(
      amount: number,
      email: string,
      userId?: string,
      locale?: string
    ): Promise<{ paymentIntentClientSecret: string }> {
      if (amount < 100) throw new Error("Minimum donation amount is CHF 1.00 (100 cents)");

      const paymentIntent = await getStripe().paymentIntents.create({
        amount,
        currency: "chf",
        receipt_email: email,
        payment_method_types: ["card", "twint"],
        metadata: {
          type: "donation",
          userId: userId ?? "",
          locale: locale ?? "de",
          email,
        },
      });

      return { paymentIntentClientSecret: paymentIntent.client_secret! };
    },

    async handleDonationWebhook(session: Stripe.Checkout.Session): Promise<void> {
      const userId = session.metadata?.userId || null;
      const email = session.customer_email ?? session.customer_details?.email ?? "";
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? session.id);

      const inserted = await db.admin
        .insert(donations)
        .values({
          userId: userId || null,
          email,
          stripePaymentId: paymentIntentId,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? "chf",
          status: "succeeded",
        })
        .onConflictDoNothing()
        .returning({ id: donations.id });
      if (inserted.length === 0) return;

      // Profile lookup for fullName; locale comes from checkout session metadata
      const profile = userId ? await db.admin.query.profiles.findFirst({ where: { id: userId } }) : undefined;

      await sendDonationConfirmationEmail({
        email,
        fullName: profile?.fullName ?? null,
        locale: session.metadata?.locale ?? "de",
        amount: session.amount_total ?? 0,
      });
    },

    // Native (PaymentSheet) equivalent — a standalone donation PaymentIntent created via
    // createDonationIntent, guarded on our own metadata.type like the membership handler.
    async handleDonationPaymentIntentWebhook(paymentIntent: Stripe.PaymentIntent): Promise<void> {
      const metadata = paymentIntent.metadata;
      if (metadata?.type !== "donation") return;
      const userId = metadata.userId || null;
      const email = metadata.email || paymentIntent.receipt_email || "";

      const inserted = await db.admin
        .insert(donations)
        .values({
          userId,
          email,
          stripePaymentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: "succeeded",
        })
        .onConflictDoNothing()
        .returning({ id: donations.id });
      if (inserted.length === 0) return;

      const profile = userId ? await db.admin.query.profiles.findFirst({ where: { id: userId } }) : undefined;

      await sendDonationConfirmationEmail({
        email,
        fullName: profile?.fullName ?? null,
        locale: metadata.locale || "de",
        amount: paymentIntent.amount,
      });
    },
  };
}
