import Stripe from "stripe";
import { eq } from "drizzle-orm";
import createHttpError from "http-errors";
import { RlsDb } from "../db/db";
import { getStripe } from "../stripe/stripe";
import { farms, farmSubscriptions, farmTrials, membershipPayments } from "../db/schema";

export type MembershipStatus = {
  lastPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  autoRenewing: boolean;
  trialEnd: Date | null;
};

// Annual membership amount in CHF cents (used for manual/one-time checkout)
const ANNUAL_AMOUNT_CHF_CENTS = 29000; // 290 CHF

type CardDetails = {
  cardLast4: string | null;
  cardBrand: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
};

async function getCardDetailsFromPaymentMethod(paymentMethodId: string | null): Promise<CardDetails> {
  if (!paymentMethodId) return { cardLast4: null, cardBrand: null, cardExpMonth: null, cardExpYear: null };
  const pm = await getStripe().paymentMethods.retrieve(paymentMethodId);
  if (!pm.card) return { cardLast4: null, cardBrand: null, cardExpMonth: null, cardExpYear: null };
  return {
    cardLast4: pm.card.last4,
    cardBrand: pm.card.brand,
    cardExpMonth: pm.card.exp_month,
    cardExpYear: pm.card.exp_year,
  };
}

export function membershipApi(db: RlsDb) {
  // Get or create a Stripe Customer for the farm, storing the ID on the farms row
  async function getOrCreateStripeCustomer(farmId: string): Promise<string> {
    const farm = await db.admin.query.farms.findFirst({ where: { id: farmId } });
    if (!farm) throw new Error(`Farm ${farmId} not found`);

    if (farm.stripeCustomerId) return farm.stripeCustomerId;

    const customer = await getStripe().customers.create({
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
      const activeTrial = await db.admin.query.farmTrials.findFirst({
        where: { farmId, endsAt: { gt: now } },
      });
      if (activeTrial) return true;
      const active = await db.admin.query.membershipPayments.findFirst({
        where: { farmId, status: "succeeded", periodEnd: { gt: now } },
      });
      return active !== undefined;
    },

    // Paid membership only — excludes trial. Use for write-gated operations.
    async isPaidMember(farmId: string): Promise<boolean> {
      const now = new Date();
      const active = await db.admin.query.membershipPayments.findFirst({
        where: { farmId, status: "succeeded", periodEnd: { gt: now } },
      });
      return active !== undefined;
    },

    async startTrial(farmId: string): Promise<{ trialEnd: Date }> {
      const existing = await db.admin.query.farmTrials.findFirst({ where: { farmId } });
      if (existing) throw createHttpError(409, "Trial already used for this farm");
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + 30);
      await db.admin.insert(farmTrials).values({ farmId, endsAt });
      return { trialEnd: endsAt };
    },

    // Stripe Subscription checkout (yearly, auto-renewing).
    async createSubscriptionCheckout(
      farmId: string,
      successUrl: string,
      cancelUrl: string,
    ): Promise<{ url: string }> {
      const priceId = process.env.STRIPE_MEMBERSHIP_PRICE_ID_YEARLY;
      if (!priceId) throw new Error("STRIPE_MEMBERSHIP_PRICE_ID_YEARLY env var not set");

      const customerId = await getOrCreateStripeCustomer(farmId);

      // If an active trial exists, delay billing until it ends
      const now = new Date();
      const activeTrial = await db.admin.query.farmTrials.findFirst({
        where: { farmId, endsAt: { gt: now } },
      });

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: "membership", farmId },
        subscription_data: activeTrial
          ? { trial_end: Math.floor(activeTrial.endsAt.getTime() / 1000) }
          : undefined,
        allow_promotion_codes: true,
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

      const session = await getStripe().checkout.sessions.create({
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

    // Stripe Setup mode checkout to update payment method on an existing subscription
    async createPaymentMethodSetup(
      farmId: string,
      successUrl: string,
      cancelUrl: string,
    ): Promise<{ url: string }> {
      const customerId = await getOrCreateStripeCustomer(farmId);

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: "setup",
        currency: "chf",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: "payment_method_setup", farmId },
      });

      return { url: session.url! };
    },

    async reactivateSubscription(farmId: string): Promise<{ cancelAtPeriodEnd: boolean }> {
      const subscription = await db.admin.query.farmSubscriptions.findFirst({
        where: { farmId },
      });

      if (!subscription) throw new Error("No active subscription found for this farm");

      await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      await db.admin
        .update(farmSubscriptions)
        .set({ cancelAtPeriodEnd: false })
        .where(eq(farmSubscriptions.farmId, farmId));

      return { cancelAtPeriodEnd: false };
    },

    async getStatus(farmId: string): Promise<MembershipStatus> {
      const now = new Date();

      // Find the latest succeeded payment (may be expired)
      const latestPayment = await db.admin.query.membershipPayments.findFirst({
        where: { farmId, status: "succeeded" },
        orderBy: { periodEnd: "desc" },
      });

      // Check if there's a subscription row
      const subscription = await db.admin.query.farmSubscriptions.findFirst({
        where: { farmId },
      });

      // Source trial end from farmTrials (self-hosted, no credit card)
      const trial = await db.admin.query.farmTrials.findFirst({ where: { farmId } });

      return {
        lastPeriodEnd: latestPayment?.periodEnd ?? null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        autoRenewing: subscription !== undefined,
        trialEnd: trial?.endsAt ?? null,
      };
    },

    async cancelSubscription(farmId: string): Promise<{ cancelAtPeriodEnd: boolean }> {
      const subscription = await db.admin.query.farmSubscriptions.findFirst({
        where: { farmId },
      });

      if (!subscription) throw new Error("No active subscription found for this farm");

      await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
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

        // Payment method setup: attach the new card to the existing subscription
        if (session.mode === "setup" && session.metadata?.type === "payment_method_setup" && session.setup_intent) {
          const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id;
          const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId);
          const sub = await db.admin.query.farmSubscriptions.findFirst({ where: { farmId } });
          if (sub && setupIntent.payment_method) {
            await getStripe().subscriptions.update(sub.stripeSubscriptionId, {
              default_payment_method: setupIntent.payment_method as string,
            });
          }
          return;
        }

        if (session.mode === "subscription" && session.subscription) {
          // Fetch the full subscription to get period info
          const stripeSubscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const stripeSubscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);

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
              ? await getStripe().invoices.retrieve(invoice)
              : invoice;

            const pmId = typeof stripeSubscription.default_payment_method === "string"
              ? stripeSubscription.default_payment_method
              : stripeSubscription.default_payment_method?.id ?? null;
            const cardDetails = await getCardDetailsFromPaymentMethod(pmId);

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
                ...cardDetails,
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

          // Retrieve payment intent to get the payment method used
          const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
            expand: ["payment_method"],
          });
          const pmId = typeof paymentIntent.payment_method === "string"
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id ?? null;
          const cardDetails = await getCardDetailsFromPaymentMethod(pmId);

          await db.admin
            .insert(membershipPayments)
            .values({
              farmId,
              stripePaymentId: paymentIntentId,
              amount: session.amount_total ?? ANNUAL_AMOUNT_CHF_CENTS,
              currency: session.currency ?? "chf",
              status: "succeeded",
              periodEnd,
              ...cardDetails,
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
        const stripeSubscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
        const firstItem = stripeSubscription.items.data[0];
        const periodEnd = new Date((firstItem?.current_period_end ?? 0) * 1000);

        const pmId = typeof stripeSubscription.default_payment_method === "string"
          ? stripeSubscription.default_payment_method
          : stripeSubscription.default_payment_method?.id ?? null;
        const cardDetails = await getCardDetailsFromPaymentMethod(pmId);

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
            ...cardDetails,
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
