import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { stripe } from "../stripe/stripe";
import { farms, farmSubscriptions, membershipPayments } from "../db/schema";

export type MembershipStatus = {
  active: boolean;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  autoRenewing: boolean;
};

// Annual membership amount in CHF cents (used for manual/one-time checkout)
const ANNUAL_AMOUNT_CHF_CENTS = 29000; // 290 CHF

export function membershipApi(db: RlsDb) {
  // Get or create a Stripe Customer for the farm, storing the ID on the farms row
  async function getOrCreateStripeCustomer(farmId: string): Promise<string> {
    const farm = await db.admin.query.farms.findFirst({ where: { id: farmId } });
    if (!farm) throw new Error(`Farm ${farmId} not found`);

    if (farm.stripeCustomerId) return farm.stripeCustomerId;

    const customer = await stripe.customers.create({
      metadata: { farmId },
      name: farm.name,
    });

    await db.admin
      .update(farms)
      .set({ stripeCustomerId: customer.id })
      .where(eq(farms.id, farmId));

    return customer.id;
  }

  return {
    async isActive(farmId: string): Promise<boolean> {
      const now = new Date();
      const active = await db.admin.query.membershipPayments.findFirst({
        where: { farmId, status: "succeeded", periodEnd: { gt: now } },
      });
      return active !== undefined;
    },

    // Stripe Subscription checkout (auto-renewing annual)
    async createSubscriptionCheckout(
      farmId: string,
      successUrl: string,
      cancelUrl: string,
    ): Promise<{ url: string }> {
      const priceId = process.env.STRIPE_MEMBERSHIP_PRICE_ID;
      if (!priceId) throw new Error("STRIPE_MEMBERSHIP_PRICE_ID env var not set");

      const customerId = await getOrCreateStripeCustomer(farmId);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: "membership", farmId },
      });

      return { url: session.url! };
    },

    // One-time annual payment checkout (no auto-renew)
    async createManualCheckout(
      farmId: string,
      successUrl: string,
      cancelUrl: string,
    ): Promise<{ url: string }> {
      const customerId = await getOrCreateStripeCustomer(farmId);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "chf",
              unit_amount: ANNUAL_AMOUNT_CHF_CENTS,
              product_data: { name: "Jahres-Mitgliedschaft" },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: "membership", farmId },
      });

      return { url: session.url! };
    },

    async createPortalSession(
      farmId: string,
      returnUrl: string,
    ): Promise<{ url: string }> {
      const customerId = await getOrCreateStripeCustomer(farmId);
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return { url: session.url };
    },

    async getStatus(farmId: string): Promise<MembershipStatus> {
      const now = new Date();

      // Find the latest succeeded payment that covers today
      const activePayment = await db.admin.query.membershipPayments.findFirst({
        where: { farmId, status: "succeeded", periodEnd: { gt: now } },
        orderBy: { periodEnd: "desc" },
      });

      // Check if there's a subscription row
      const subscription = await db.admin.query.farmSubscriptions.findFirst({
        where: { farmId },
      });

      return {
        active: activePayment !== undefined,
        currentPeriodEnd: activePayment?.periodEnd ?? null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        autoRenewing: subscription !== undefined,
      };
    },

    async cancelSubscription(farmId: string): Promise<{ cancelAtPeriodEnd: boolean }> {
      const subscription = await db.admin.query.farmSubscriptions.findFirst({
        where: { farmId },
      });

      if (!subscription) throw new Error("No active subscription found for this farm");

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await db.admin
        .update(farmSubscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(farmSubscriptions.farmId, farmId));

      return { cancelAtPeriodEnd: true };
    },

    async getPayments(farmId: string) {
      return db.admin.query.membershipPayments.findMany({
        where: { farmId },
        orderBy: { createdAt: "desc" },
      });
    },

    async handleWebhookEvent(event: Stripe.Event): Promise<void> {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const farmId = session.metadata?.farmId;
        if (!farmId) return;

        if (session.mode === "subscription" && session.subscription) {
          // Fetch the full subscription to get period info
          const stripeSubscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

          // Upsert farmSubscriptions row
          await db.admin
            .insert(farmSubscriptions)
            .values({
              farmId,
              stripeSubscriptionId,
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            })
            .onConflictDoUpdate({
              target: farmSubscriptions.farmId,
              set: { stripeSubscriptionId, cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end },
            });

          // Insert membership payment row for first invoice
          // Period end is taken from the first subscription item (new Stripe API places it there)
          const firstItem = stripeSubscription.items.data[0];
          const periodEnd = new Date((firstItem?.current_period_end ?? 0) * 1000);

          const invoice = stripeSubscription.latest_invoice;
          if (invoice) {
            const stripeInvoice = typeof invoice === "string"
              ? await stripe.invoices.retrieve(invoice)
              : invoice;

            await db.admin
              .insert(membershipPayments)
              .values({
                farmId,
                stripePaymentId: stripeInvoice.id,
                stripeSubscriptionId,
                amount: stripeInvoice.amount_paid,
                currency: stripeInvoice.currency,
                status: "succeeded",
                periodEnd,
              })
              .onConflictDoNothing();
          }
        } else if (session.mode === "payment" && session.metadata?.type === "membership") {
          // Manual one-time payment — period starts now, ends +1 year
          const periodEnd = new Date();
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);

          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? session.id);

          await db.admin
            .insert(membershipPayments)
            .values({
              farmId,
              stripePaymentId: paymentIntentId,
              amount: session.amount_total ?? ANNUAL_AMOUNT_CHF_CENTS,
              currency: session.currency ?? "chf",
              status: "succeeded",
              periodEnd,
            })
            .onConflictDoNothing();
        }
      } else if (event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object as Stripe.Invoice;
        // In Stripe API 2026+, subscription ID lives in parent.subscription_details.subscription
        const subRef = invoice.parent?.subscription_details?.subscription;
        const stripeSubscriptionId =
          typeof subRef === "string" ? subRef : subRef?.id;

        if (!stripeSubscriptionId) return;

        // Look up farmId from farmSubscriptions
        const sub = await db.admin.query.farmSubscriptions.findFirst({
          where: { stripeSubscriptionId },
        });
        if (!sub) return;

        // Fetch the subscription to get current period end from items
        const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const firstItem = stripeSubscription.items.data[0];
        const periodEnd = new Date((firstItem?.current_period_end ?? 0) * 1000);

        await db.admin
          .insert(membershipPayments)
          .values({
            farmId: sub.farmId,
            stripePaymentId: invoice.id,
            stripeSubscriptionId,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            periodEnd,
          })
          .onConflictDoNothing();
      } else if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const stripeSubscriptionId =
          typeof subRef === "string" ? subRef : subRef?.id;

        if (!stripeSubscriptionId) return;

        const sub = await db.admin.query.farmSubscriptions.findFirst({
          where: { stripeSubscriptionId },
        });
        if (!sub) return;

        await db.admin
          .insert(membershipPayments)
          .values({
            farmId: sub.farmId,
            stripePaymentId: invoice.id,
            stripeSubscriptionId,
            amount: invoice.amount_due,
            currency: invoice.currency,
            status: "failed",
            // Period end is still the subscription's current_period_end
            periodEnd: new Date(0),
          })
          .onConflictDoNothing();
      } else if (event.type === "customer.subscription.updated") {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        await db.admin
          .update(farmSubscriptions)
          .set({ cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end })
          .where(
            eq(farmSubscriptions.stripeSubscriptionId, stripeSubscription.id),
          );
      } else if (event.type === "customer.subscription.deleted") {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        await db.admin
          .delete(farmSubscriptions)
          .where(
            eq(farmSubscriptions.stripeSubscriptionId, stripeSubscription.id),
          );
      }
    },
  };
}
