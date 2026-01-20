import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import { paymentMethodSchema } from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

// API Schemas - decoupled from database schema for stable API contract
export const paymentSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  contactId: z.string(),
  sponsorshipId: z.string().nullable(),
  orderId: z.string().nullable(),
  date: ez.dateOut(),
  amount: z.number(),
  currency: z.string(),
  method: paymentMethodSchema,
  notes: z.string().nullable(),
});

const createPaymentSchema = z.object({
  contactId: z.string(),
  sponsorshipId: z.string().optional(),
  orderId: z.string().optional(),
  date: ez.dateIn(),
  amount: z.number(),
  currency: z.string().default("CHF"),
  method: paymentMethodSchema,
  notes: z.string().optional(),
});

const updatePaymentSchema = createPaymentSchema.partial();

export const getPaymentByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ paymentId: z.string() }),
  output: paymentSchema,
  handler: async ({ input, ctx: { payments } }) => {
    const payment = await payments.getPaymentById(input.paymentId);
    if (!payment) {
      throw createHttpError(404, "Payment not found");
    }
    return payment;
  },
});

export const getFarmPaymentsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(paymentSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { payments, farmId } }) => {
    const result = await payments.getPaymentsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getContactPaymentsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ contactId: z.string() }),
  output: z.object({
    result: z.array(paymentSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { payments } }) => {
    const result = await payments.getPaymentsForContact(input.contactId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createPaymentEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createPaymentSchema,
  output: paymentSchema,
  handler: async ({ input, ctx: { payments } }) => {
    return payments.createPayment(input);
  },
});

export const updatePaymentEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updatePaymentSchema.extend({
    paymentId: z.string(),
  }),
  output: paymentSchema,
  handler: async ({ input, ctx: { payments } }) => {
    const { paymentId, ...data } = input;
    return payments.updatePayment(paymentId, data);
  },
});

export const deletePaymentEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ paymentId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { paymentId }, ctx: { payments } }) => {
    await payments.deletePayment(paymentId);
    return {};
  },
});
