import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getPaymentByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ paymentId: z.string() }),
  output: tables.selectPaymentSchema,
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
    result: z.array(tables.selectPaymentSchema),
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
    result: z.array(tables.selectPaymentSchema),
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
  input: tables.insertPaymentSchema.omit({ farmId: true, id: true }),
  output: tables.selectPaymentSchema,
  handler: async ({ input, ctx: { payments } }) => {
    return payments.createPayment(input);
  },
});

export const updatePaymentEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updatePaymentSchema.omit({ id: true, farmId: true }).extend({
    paymentId: z.string(),
  }),
  output: tables.selectPaymentSchema,
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
