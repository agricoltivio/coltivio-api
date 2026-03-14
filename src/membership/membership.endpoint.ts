import { z } from "zod";
import createHttpError from "http-errors";
import { farmEndpointFactory } from "../endpoint-factory";
import { membershipPaymentStatusSchema } from "../db/schema";

const membershipPaymentSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  userId: z.string().nullable(),
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

export const createSubscriptionCheckoutEndpoint = farmEndpointFactory.build({
  method: "post",
  input: checkoutUrlInput,
  output: z.object({ url: z.string() }),
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can manage membership");
    }
    return ctx.membership.createSubscriptionCheckout(
      ctx.farmId,
      input.successUrl,
      input.cancelUrl,
    );
  },
});

export const createManualCheckoutEndpoint = farmEndpointFactory.build({
  method: "post",
  input: checkoutUrlInput,
  output: z.object({ url: z.string() }),
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can manage membership");
    }
    return ctx.membership.createManualCheckout(
      ctx.farmId,
      input.successUrl,
      input.cancelUrl,
    );
  },
});

export const createPaymentMethodSetupEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  }),
  output: z.object({ url: z.string() }),
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can manage membership");
    }
    return ctx.membership.createPaymentMethodSetup(ctx.farmId, input.successUrl, input.cancelUrl);
  },
});

export const reactivateMembershipEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({}),
  output: z.object({ cancelAtPeriodEnd: z.boolean() }),
  handler: async ({ ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can manage membership");
    }
    return ctx.membership.reactivateSubscription(ctx.farmId);
  },
});

export const getMembershipStatusEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: membershipStatusSchema,
  handler: async ({ ctx }) => {
    return ctx.membership.getStatus(ctx.farmId);
  },
});

export const cancelMembershipEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({}),
  output: z.object({ cancelAtPeriodEnd: z.boolean() }),
  handler: async ({ ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can cancel membership");
    }
    return ctx.membership.cancelSubscription(ctx.farmId);
  },
});

export const startTrialEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({}),
  output: z.object({ trialEnd: z.date() }),
  handler: async ({ ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can start a trial");
    }
    return ctx.membership.startTrial(ctx.farmId);
  },
});

export const getMembershipPaymentsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(membershipPaymentSchema),
    count: z.number(),
  }),
  handler: async ({ ctx }) => {
    const result = await ctx.membership.getPayments(ctx.farmId);
    return { result, count: result.length };
  },
});
