import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import { orderStatusSchema } from "../db/schema";
import { contactSchema } from "../contacts/contacts.endpoint";
import { paymentSchema } from "../payments/payments.endpoint";
import { productSchema } from "../products/products.endpoint";
import { farmEndpointFactory } from "../endpoint-factory";

// API Schemas - decoupled from database schema for stable API contract
export const orderSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  contactId: z.string(),
  status: orderStatusSchema,
  orderDate: ez.dateOut(),
  shippingDate: ez.dateOut().nullable(),
  notes: z.string().nullable(),
});

export const orderItemSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  orderId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
});

const orderItemWithProductSchema = orderItemSchema.extend({
  product: productSchema,
});

const orderExtendedSchema = orderSchema.extend({
  contact: contactSchema,
  items: z.array(orderItemWithProductSchema),
  payments: z.array(paymentSchema),
});

const orderItemInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
});

export const getOrderByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ orderId: z.string() }),
  output: orderExtendedSchema,
  handler: async ({ input, ctx: { orders } }) => {
    const order = await orders.getOrderByIdWithRelations(input.orderId);
    if (!order) {
      throw createHttpError(404, "Order not found");
    }
    return order;
  },
});

export const getFarmOrdersEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(orderSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { orders, farmId } }) => {
    const result = await orders.getOrdersForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getContactOrdersEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ contactId: z.string() }),
  output: z.object({
    result: z.array(orderSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { orders } }) => {
    const result = await orders.getOrdersForContact(input.contactId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getOrderItemsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ orderId: z.string() }),
  output: z.object({
    result: z.array(orderItemSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { orders } }) => {
    const result = await orders.getOrderItems(input.orderId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createOrderEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    contactId: z.string(),
    orderDate: ez.dateIn(),
    shippingDate: ez.dateIn().optional(),
    notes: z.string().optional(),
    items: z.array(orderItemInputSchema).min(1),
  }),
  output: orderExtendedSchema,
  handler: async ({ input, ctx: { orders } }) => {
    const { items, ...orderData } = input;
    return orders.createOrder(orderData, items);
  },
});

export const confirmOrderEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({ orderId: z.string() }),
  output: orderExtendedSchema,
  handler: async ({ input, ctx: { orders } }) => {
    return orders.confirmOrder(input.orderId);
  },
});

export const fulfillOrderEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({ orderId: z.string() }),
  output: orderExtendedSchema,
  handler: async ({ input, ctx: { orders } }) => {
    return orders.fulfillOrder(input.orderId);
  },
});

export const cancelOrderEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({ orderId: z.string() }),
  output: orderExtendedSchema,
  handler: async ({ input, ctx: { orders } }) => {
    return orders.cancelOrder(input.orderId);
  },
});

export const updateOrderEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: z.object({
    orderId: z.string(),
    notes: z.string().optional(),
    shippingDate: ez.dateIn().optional(),
  }),
  output: orderExtendedSchema,
  handler: async ({ input, ctx: { orders } }) => {
    const { orderId, ...data } = input;
    return orders.updateOrderNotes(orderId, data);
  },
});

export const getOrderPaymentsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ orderId: z.string() }),
  output: z.object({
    result: z.array(paymentSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { payments } }) => {
    const result = await payments.getPaymentsForOrder(input.orderId);
    return {
      result,
      count: result.length,
    };
  },
});
