import { z } from "zod";
import { authenticatedEndpointFactory } from "../endpoint-factory";
import { membershipPaymentStatusSchema } from "../db/schema";

const membershipPaymentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  stripePaymentId: z.string(),
  stripeSubscriptionId: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: membershipPaymentStatusSchema,
  periodEnd: z.date(),
  cardLast4: z.string().nullable(),
  cardBrand: z.string().nullable(),
  cardExpMonth: z.number().nullable(),
  cardExpYear: z.number().nullable(),
  createdAt: z.date(),
});

export const membershipStatusSchema = z.object({
  lastPeriodEnd: z.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  autoRenewing: z.boolean(),
  trialEnd: z.date().nullable(),
});

const checkoutUrlInput = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const createSubscriptionCheckoutEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: checkoutUrlInput,
  output: z.object({ url: z.string() }),
  handler: async ({ input, ctx }) => {
    return ctx.membership.createSubscriptionCheckout(ctx.user.id, input.successUrl, input.cancelUrl);
  },
});

export const createManualCheckoutEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: checkoutUrlInput,
  output: z.object({ url: z.string() }),
  handler: async ({ input, ctx }) => {
    return ctx.membership.createManualCheckout(ctx.user.id, input.successUrl, input.cancelUrl);
  },
});

export const createPaymentMethodSetupEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: z.object({
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  }),
  output: z.object({ url: z.string() }),
  handler: async ({ input, ctx }) => {
    return ctx.membership.createPaymentMethodSetup(ctx.user.id, input.successUrl, input.cancelUrl);
  },
});

export const reactivateMembershipEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: z.object({}),
  output: z.object({ cancelAtPeriodEnd: z.boolean() }),
  handler: async ({ ctx }) => {
    return ctx.membership.reactivateSubscription(ctx.user.id);
  },
});

export const getMembershipStatusEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: membershipStatusSchema,
  handler: async ({ ctx }) => {
    return ctx.membership.getStatus(ctx.user.id);
  },
});

export const cancelMembershipEndpoint = authenticatedEndpointFactory.build({
  method: "delete",
  input: z.object({}),
  output: z.object({ cancelAtPeriodEnd: z.boolean() }),
  handler: async ({ ctx }) => {
    return ctx.membership.cancelSubscription(ctx.user.id);
  },
});

export const startTrialEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: z.object({}),
  output: z.object({ trialEnd: z.date() }),
  handler: async ({ ctx }) => {
    return ctx.membership.startTrial(ctx.user.id);
  },
});

export const getMembershipPaymentsEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(membershipPaymentSchema),
    count: z.number(),
  }),
  handler: async ({ ctx }) => {
    const result = await ctx.membership.getPayments(ctx.user.id);
    return { result, count: result.length };
  },
});
