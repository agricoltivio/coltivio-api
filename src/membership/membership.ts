// TESTPHASE: set UNLIMITED_TRIAL=true in .env to bypass all membership checks.
// Revert: remove the env var (or set it to anything other than "true").
const UNLIMITED_TRIAL = process.env.UNLIMITED_TRIAL === "true";

import Stripe from "stripe";
import { eq, and, or, gt, inArray } from "drizzle-orm";
import createHttpError from "http-errors";
import { RlsDb } from "../db/db";
import { getStripe } from "../stripe/stripe";
import {
  profiles,
  userSubscriptions,
  userTrials,
  membershipPayments,
  membershipExpiryNotifications,
} from "../db/schema";
import {
  sendNewMembershipEmail,
  sendReactivationEmail,
  sendRenewalEmail,
  sendFirstPaymentEmail,
  sendPaymentFailedEmail,
  sendCancellationEmail,
} from "./membership.email";

export type MembershipStatus = {
  lastPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  autoRenewing: boolean;
  trialEnd: Date | null;
  cancelledByUser: boolean;
};

export type FarmMembershipStatus = "none" | "trial" | "active";

// Annual membership amount in CHF cents (used for manual/one-time checkout)

// Grace period: 10 days after periodEnd, users retain access
const GRACE_PERIOD_MS = 10 * 24 * 60 * 60 * 1000;

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
  // Get or create a Stripe Customer for the user, storing the ID on their profile
  async function getOrCreateStripeCustomer(userId: string): Promise<string> {
    const profile = await db.admin.query.profiles.findFirst({ where: { id: userId } });
    if (!profile) throw new Error(`Profile ${userId} not found`);

    if (profile.stripeCustomerId) return profile.stripeCustomerId;

    const customer = await getStripe().customers.create({
      metadata: { userId },
      name: profile.fullName ?? profile.email,
      email: profile.email,
    });

    await db.admin.update(profiles).set({ stripeCustomerId: customer.id }).where(eq(profiles.id, userId));

    return customer.id;
  }

  // Fetch all userIds who are members of the given farm (via profiles.farmId)
  async function getUserIdsForFarm(farmId: string): Promise<string[]> {
    const farmProfiles = await db.admin.query.profiles.findMany({
      where: { farmId },
    });
    return farmProfiles.map((p) => p.id);
  }

  return {
    // A farm is active if any of its members has an active trial or succeeded payment
    async isActive(farmId: string): Promise<boolean> {
      if (UNLIMITED_TRIAL) return true;
      const userIds = await getUserIdsForFarm(farmId);
      if (userIds.length === 0) return false;

      const now = new Date();
      const activeTrial = await db.admin.query.userTrials.findFirst({
        where: { userId: { in: userIds }, endsAt: { gt: now } },
      });
      if (activeTrial) return true;

      // Cancelled users lose grace period — their access ends at periodEnd
      const active = await db.admin
        .select({ id: membershipPayments.id })
        .from(membershipPayments)
        .where(
          and(
            inArray(membershipPayments.userId, userIds),
            eq(membershipPayments.status, "succeeded"),
            or(
              and(
                eq(membershipPayments.cancelledByUser, false),
                gt(membershipPayments.periodEnd, new Date(now.getTime() - GRACE_PERIOD_MS))
              ),
              and(eq(membershipPayments.cancelledByUser, true), gt(membershipPayments.periodEnd, now))
            )
          )
        )
        .limit(1);
      return active.length > 0;
    },

    async getFarmMembershipStatus(farmId: string): Promise<FarmMembershipStatus> {
      if (UNLIMITED_TRIAL) return "trial";
      const userIds = await getUserIdsForFarm(farmId);
      if (userIds.length === 0) return "none";

      const now = new Date();
      const active = await db.admin.query.membershipPayments.findFirst({
        where: { userId: { in: userIds }, status: "succeeded", periodEnd: { gt: now } },
      });
      if (active) return "active";

      const trial = await db.admin.query.userTrials.findFirst({
        where: { userId: { in: userIds }, endsAt: { gt: now } },
      });
      return trial ? "trial" : "none";
    },

    // Paid membership only — excludes trial. Use for write-gated operations.
    async isPaidMember(farmId: string): Promise<boolean> {
      if (UNLIMITED_TRIAL) return true;
      const userIds = await getUserIdsForFarm(farmId);
      if (userIds.length === 0) return false;

      const now = new Date();
      const active = await db.admin
        .select({ id: membershipPayments.id })
        .from(membershipPayments)
        .where(
          and(
            inArray(membershipPayments.userId, userIds),
            eq(membershipPayments.status, "succeeded"),
            or(
              and(
                eq(membershipPayments.cancelledByUser, false),
                gt(membershipPayments.periodEnd, new Date(now.getTime() - GRACE_PERIOD_MS))
              ),
              and(eq(membershipPayments.cancelledByUser, true), gt(membershipPayments.periodEnd, now))
            )
          )
        )
        .limit(1);
      return active.length > 0;
    },

    // User-scoped active check (trial OR paid). Used for forum which is not farm-scoped.
    async isActiveUser(userId: string): Promise<boolean> {
      if (UNLIMITED_TRIAL) return true;
      const now = new Date();
      const activeTrial = await db.admin.query.userTrials.findFirst({
        where: { userId, endsAt: { gt: now } },
      });
      if (activeTrial) return true;

      const active = await db.admin
        .select({ id: membershipPayments.id })
        .from(membershipPayments)
        .where(
          and(
            eq(membershipPayments.userId, userId),
            eq(membershipPayments.status, "succeeded"),
            or(
              and(
                eq(membershipPayments.cancelledByUser, false),
                gt(membershipPayments.periodEnd, new Date(now.getTime() - GRACE_PERIOD_MS))
              ),
              and(eq(membershipPayments.cancelledByUser, true), gt(membershipPayments.periodEnd, now))
            )
          )
        )
        .limit(1);
      return active.length > 0;
    },

    // User-scoped paid-only check (excludes trial). Used for forum write operations.
    async isPaidUser(userId: string): Promise<boolean> {
      if (UNLIMITED_TRIAL) return true;
      const now = new Date();
      const active = await db.admin
        .select({ id: membershipPayments.id })
        .from(membershipPayments)
        .where(
          and(
            eq(membershipPayments.userId, userId),
            eq(membershipPayments.status, "succeeded"),
            or(
              and(
                eq(membershipPayments.cancelledByUser, false),
                gt(membershipPayments.periodEnd, new Date(now.getTime() - GRACE_PERIOD_MS))
              ),
              and(eq(membershipPayments.cancelledByUser, true), gt(membershipPayments.periodEnd, now))
            )
          )
        )
        .limit(1);
      return active.length > 0;
    },

    async startTrial(userId: string): Promise<{ trialEnd: Date }> {
      const profile = await db.admin.query.profiles.findFirst({ where: { id: userId } });

      // If the user belongs to a farm, check that no user in that farm has ever had a trial
      if (profile?.farmId) {
        const farmUserIds = await getUserIdsForFarm(profile.farmId);
        const farmTrial = await db.admin.query.userTrials.findFirst({
          where: { userId: { in: farmUserIds } },
        });
        if (farmTrial) throw createHttpError(409, "Trial already used for this farm");
      } else {
        const existing = await db.admin.query.userTrials.findFirst({ where: { userId } });
        if (existing) throw createHttpError(409, "Trial already used for this user");
      }

      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + 30);
      await db.admin.insert(userTrials).values({ userId, endsAt });
      return { trialEnd: endsAt };
    },

    // Stripe Subscription checkout (yearly, auto-renewing).
    async createSubscriptionCheckout(
      userId: string,
      locale: string,
      successUrl: string,
      cancelUrl: string
    ): Promise<{ url: string }> {
      const priceId = process.env.STRIPE_MEMBERSHIP_PRICE_ID_YEARLY;
      if (!priceId) throw new Error("STRIPE_MEMBERSHIP_PRICE_ID_YEARLY env var not set");

      const customerId = await getOrCreateStripeCustomer(userId);

      // If an active trial exists, delay billing until it ends
      const now = new Date();
      const activeTrial = await db.admin.query.userTrials.findFirst({
        where: { userId, endsAt: { gt: now } },
      });

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: "membership", userId },
        subscription_data: activeTrial ? { trial_end: Math.floor(activeTrial.endsAt.getTime() / 1000) } : undefined,
        allow_promotion_codes: true,
        locale: locale as "de" | "en" | "it" | "fr",
      });

      return { url: session.url! };
    },

    // One-time annual payment checkout (no auto-renew)
    async createManualCheckout(
      userId: string,
      locale: string,
      successUrl: string,
      cancelUrl: string
    ): Promise<{ url: string }> {
      const priceId = process.env.STRIPE_MEMBERSHIP_PRICE_ID_MANUAL;
      if (!priceId) throw new Error("STRIPE_MEMBERSHIP_PRICE_ID_MANUAL env var not set");

      const customerId = await getOrCreateStripeCustomer(userId);

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        payment_method_types: ["card", "twint"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: "membership", userId },
        locale: locale as "de" | "en" | "it" | "fr",
      });

      return { url: session.url! };
    },

    // Stripe Setup mode checkout to update payment method on an existing subscription
    async createPaymentMethodSetup(userId: string, successUrl: string, cancelUrl: string): Promise<{ url: string }> {
      const customerId = await getOrCreateStripeCustomer(userId);

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: "setup",
        currency: "chf",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { type: "payment_method_setup", userId },
      });

      return { url: session.url! };
    },

    async reactivateSubscription(userId: string): Promise<{ cancelAtPeriodEnd: boolean }> {
      const subscription = await db.admin.query.userSubscriptions.findFirst({
        where: { userId },
      });

      if (!subscription) {
        // One-time payment user — just clear the cancelled flag, no Stripe interaction needed
        const latestPayment = await db.admin.query.membershipPayments.findFirst({
          where: { userId, status: "succeeded" },
          orderBy: { periodEnd: "desc" },
        });
        if (latestPayment) {
          await db.admin
            .update(membershipPayments)
            .set({ cancelledByUser: false })
            .where(eq(membershipPayments.id, latestPayment.id));

          const profile = await db.admin.query.profiles.findFirst({ where: { id: userId } });
          if (profile) {
            await sendReactivationEmail({
              email: profile.email,
              fullName: profile.fullName,
              locale: profile.locale,
              periodEnd: latestPayment.periodEnd,
            });
          }
        }
        return { cancelAtPeriodEnd: false };
      }

      await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      await db.admin
        .update(userSubscriptions)
        .set({ cancelAtPeriodEnd: false })
        .where(eq(userSubscriptions.userId, userId));

      const latestPayment = await db.admin.query.membershipPayments.findFirst({
        where: { userId, status: "succeeded" },
        orderBy: { periodEnd: "desc" },
      });
      if (latestPayment) {
        await db.admin
          .update(membershipPayments)
          .set({ cancelledByUser: false })
          .where(eq(membershipPayments.id, latestPayment.id));

        const profile = await db.admin.query.profiles.findFirst({ where: { id: userId } });
        if (profile) {
          await sendReactivationEmail({
            email: profile.email,
            fullName: profile.fullName,
            locale: profile.locale,
            periodEnd: latestPayment.periodEnd,
          });
        }
      }

      return { cancelAtPeriodEnd: false };
    },

    async getStatus(userId: string): Promise<MembershipStatus> {
      // Find the latest succeeded payment (may be expired)
      const latestPayment = await db.admin.query.membershipPayments.findFirst({
        where: { userId, status: "succeeded" },
        orderBy: { periodEnd: "desc" },
      });

      const subscription = await db.admin.query.userSubscriptions.findFirst({
        where: { userId },
      });

      const trial = await db.admin.query.userTrials.findFirst({ where: { userId } });

      return {
        lastPeriodEnd: latestPayment?.periodEnd ?? null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        autoRenewing: subscription !== undefined,
        trialEnd: trial?.endsAt ?? null,
        cancelledByUser: latestPayment?.cancelledByUser ?? false,
      };
    },

    async cancelSubscription(userId: string): Promise<{ cancelAtPeriodEnd: boolean }> {
      const subscription = await db.admin.query.userSubscriptions.findFirst({
        where: { userId },
      });

      if (subscription) {
        await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        await db.admin
          .update(userSubscriptions)
          .set({ cancelAtPeriodEnd: true })
          .where(eq(userSubscriptions.userId, userId));
      }

      // Mark the latest succeeded payment so the expiry cron skips this user
      const latestPayment = await db.admin.query.membershipPayments.findFirst({
        where: { userId, status: "succeeded" },
        orderBy: { periodEnd: "desc" },
      });
      if (latestPayment) {
        await db.admin
          .update(membershipPayments)
          .set({ cancelledByUser: true })
          .where(and(eq(membershipPayments.id, latestPayment.id)));

        const profile = await db.admin.query.profiles.findFirst({ where: { id: userId } });
        if (profile) {
          await sendCancellationEmail({
            email: profile.email,
            fullName: profile.fullName,
            locale: profile.locale,
            periodEnd: latestPayment.periodEnd,
            reactivateUrl: `${process.env.APP_URL ?? "https://app.coltivio.ch"}/membership`,
          });
        }
      }

      return { cancelAtPeriodEnd: true };
    },

    async getPayments(userId: string) {
      return db.admin.query.membershipPayments.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
    },

    async handleWebhookEvent(event: Stripe.Event): Promise<void> {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) return;

        // Payment method setup: attach the new card to the existing subscription
        if (session.mode === "setup" && session.metadata?.type === "payment_method_setup" && session.setup_intent) {
          const setupIntentId =
            typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id;
          const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId);
          const sub = await db.admin.query.userSubscriptions.findFirst({ where: { userId } });
          if (sub && setupIntent.payment_method) {
            await getStripe().subscriptions.update(sub.stripeSubscriptionId, {
              default_payment_method: setupIntent.payment_method as string,
            });
          }
          return;
        }

        if (session.mode === "subscription" && session.subscription) {
          const stripeSubscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;

          const stripeSubscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);

          // Upsert userSubscriptions row
          await db.admin
            .insert(userSubscriptions)
            .values({
              userId,
              stripeSubscriptionId,
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            })
            .onConflictDoUpdate({
              target: userSubscriptions.userId,
              set: { stripeSubscriptionId, cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end },
            });

          const firstItem = stripeSubscription.items.data[0];
          const periodEnd = new Date((firstItem?.current_period_end ?? 0) * 1000);

          const invoice = stripeSubscription.latest_invoice;
          if (invoice) {
            const stripeInvoice = typeof invoice === "string" ? await getStripe().invoices.retrieve(invoice) : invoice;

            const pmId =
              typeof stripeSubscription.default_payment_method === "string"
                ? stripeSubscription.default_payment_method
                : (stripeSubscription.default_payment_method?.id ?? null);
            const cardDetails = await getCardDetailsFromPaymentMethod(pmId);

            const isFirstMembership = !(await db.admin.query.membershipPayments.findFirst({
              where: { userId, status: "succeeded" },
            }));

            await db.admin
              .insert(membershipPayments)
              .values({
                userId,
                stripePaymentId: stripeInvoice.id,
                stripeSubscriptionId,
                amount: stripeInvoice.amount_paid,
                currency: stripeInvoice.currency,
                status: "succeeded",
                periodEnd,
                ...cardDetails,
              })
              .onConflictDoNothing();

            const profile = await db.admin.query.profiles.findFirst({ where: { id: userId } });
            if (profile) {
              if (isFirstMembership) {
                await sendNewMembershipEmail({
                  email: profile.email,
                  fullName: profile.fullName,
                  locale: profile.locale,
                  amount: stripeInvoice.amount_paid,
                  periodEnd,
                  cardBrand: cardDetails.cardBrand,
                  cardLast4: cardDetails.cardLast4,
                  // Trial checkout ($0): show trial info instead of receipt
                  trialEnd: stripeInvoice.amount_paid === 0 ? periodEnd : undefined,
                });
              } else {
                await sendReactivationEmail({
                  email: profile.email,
                  fullName: profile.fullName,
                  locale: profile.locale,
                  periodEnd,
                });
              }
            }
          }
        } else if (session.mode === "payment" && session.metadata?.type === "membership") {
          const periodEnd = new Date();
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);

          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? session.id);

          const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
            expand: ["payment_method"],
          });
          const pmId =
            typeof paymentIntent.payment_method === "string"
              ? paymentIntent.payment_method
              : (paymentIntent.payment_method?.id ?? null);
          const cardDetails = await getCardDetailsFromPaymentMethod(pmId);

          const isFirstMembership = !(await db.admin.query.membershipPayments.findFirst({
            where: { userId, status: "succeeded" },
          }));

          if (session.amount_total == null) throw new Error(`Missing amount_total on session ${session.id}`);
          const amount = session.amount_total;
          await db.admin
            .insert(membershipPayments)
            .values({
              userId,
              stripePaymentId: paymentIntentId,
              amount,
              currency: session.currency ?? "chf",
              status: "succeeded",
              periodEnd,
              ...cardDetails,
            })
            .onConflictDoNothing();

          const profile = await db.admin.query.profiles.findFirst({ where: { id: userId } });
          if (profile) {
            if (isFirstMembership) {
              await sendNewMembershipEmail({
                email: profile.email,
                fullName: profile.fullName,
                locale: profile.locale,
                amount,
                periodEnd,
                cardBrand: cardDetails.cardBrand,
                cardLast4: cardDetails.cardLast4,
              });
            } else {
              await sendReactivationEmail({
                email: profile.email,
                fullName: profile.fullName,
                locale: profile.locale,
                periodEnd,
              });
            }
          }
        }
      } else if (event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const stripeSubscriptionId = typeof subRef === "string" ? subRef : subRef?.id;

        if (!stripeSubscriptionId) return;

        // Look up userId from userSubscriptions
        const sub = await db.admin.query.userSubscriptions.findFirst({
          where: { stripeSubscriptionId },
        });
        if (!sub) return;

        const stripeSubscription = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
        const firstItem = stripeSubscription.items.data[0];
        const periodEnd = new Date((firstItem?.current_period_end ?? 0) * 1000);

        const pmId =
          typeof stripeSubscription.default_payment_method === "string"
            ? stripeSubscription.default_payment_method
            : (stripeSubscription.default_payment_method?.id ?? null);
        const cardDetails = await getCardDetailsFromPaymentMethod(pmId);

        await db.admin
          .insert(membershipPayments)
          .values({
            userId: sub.userId,
            stripePaymentId: invoice.id,
            stripeSubscriptionId,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            periodEnd,
            ...cardDetails,
          })
          .onConflictDoNothing();

        // Only send email for recurring cycle payments — subscription_create is handled by checkout.session.completed
        if (invoice.billing_reason === "subscription_cycle") {
          const profile = await db.admin.query.profiles.findFirst({ where: { id: sub.userId } });
          if (profile) {
            // If the only previous payment was $0 (trial checkout), this is the first real charge
            const previousNonZeroPayment = await db.admin.query.membershipPayments.findFirst({
              where: { userId: sub.userId, status: "succeeded" },
              orderBy: { createdAt: "asc" },
            });
            const isFirstRealPayment = !previousNonZeroPayment || previousNonZeroPayment.amount === 0;

            if (isFirstRealPayment) {
              await sendFirstPaymentEmail({
                email: profile.email,
                fullName: profile.fullName,
                locale: profile.locale,
                amount: invoice.amount_paid,
                periodEnd,
                cardBrand: cardDetails.cardBrand,
                cardLast4: cardDetails.cardLast4,
              });
            } else {
              await sendRenewalEmail({
                email: profile.email,
                fullName: profile.fullName,
                locale: profile.locale,
                amount: invoice.amount_paid,
                periodEnd,
                cardBrand: cardDetails.cardBrand,
                cardLast4: cardDetails.cardLast4,
              });
            }
          }
        }
      } else if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const stripeSubscriptionId = typeof subRef === "string" ? subRef : subRef?.id;

        if (!stripeSubscriptionId) return;

        const sub = await db.admin.query.userSubscriptions.findFirst({
          where: { stripeSubscriptionId },
        });
        if (!sub) return;

        await db.admin
          .insert(membershipPayments)
          .values({
            userId: sub.userId,
            stripePaymentId: invoice.id,
            stripeSubscriptionId,
            amount: invoice.amount_due,
            currency: invoice.currency,
            status: "failed",
            periodEnd: new Date(0),
          })
          .onConflictDoNothing();

        // Find the latest succeeded payment to use as the expiry reference date
        const latestSucceeded = await db.admin.query.membershipPayments.findFirst({
          where: { userId: sub.userId, status: "succeeded" },
          orderBy: { periodEnd: "desc" },
        });

        if (latestSucceeded) {
          const inserted = await db.admin
            .insert(membershipExpiryNotifications)
            .values({ userId: sub.userId, periodEndDate: latestSucceeded.periodEnd, type: "payment_failed" })
            .onConflictDoNothing()
            .returning({ id: membershipExpiryNotifications.id });

          if (inserted.length > 0) {
            const profile = await db.admin.query.profiles.findFirst({ where: { id: sub.userId } });
            if (profile) {
              await sendPaymentFailedEmail({
                email: profile.email,
                fullName: profile.fullName,
                locale: profile.locale,
                periodEnd: latestSucceeded.periodEnd,
                renewUrl: `${process.env.APP_URL ?? "https://app.coltivio.ch"}/membership`,
              });
            }
          }
        }
      } else if (event.type === "customer.subscription.updated") {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        await db.admin
          .update(userSubscriptions)
          .set({ cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end })
          .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscription.id));
      } else if (event.type === "customer.subscription.deleted") {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        await db.admin
          .delete(userSubscriptions)
          .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscription.id));
      }
    },
  };
}
