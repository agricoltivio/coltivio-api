import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import { orderStatusSchema } from "../db/schema";
import { contactSchema } from "../contacts/contacts.endpoint";
import { paymentSchema } from "../payments/payments.endpoint";
import { productSchema } from "../products/products.endpoint";
import { membershipEndpointFactory } from "../endpoint-factory";

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

export const orderItemWithProductSchema = orderItemSchema.extend({
  product: productSchema,
});

const orderWithRelationsSchema = orderSchema.extend({
  get contact() {
    return contactSchema;
  },
  items: z.array(orderItemWithProductSchema),
  get payments() {
    return z.array(paymentSchema);
  },
});

const orderWithContactSchema = orderSchema.extend({
  get contact() {
    return contactSchema;
  },
  items: z.array(orderItemWithProductSchema),
  get payments() {
    return z.array(paymentSchema);
  },
});

const orderItemInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
});

export const getOrderByIdEndpoint = membershipEndpointFactory.build({
  method: "get",
  input: z.object({ orderId: z.string() }),
  output: orderWithRelationsSchema,
  handler: async ({ input, ctx: { orders } }) => {
    const order = await orders.getOrderById(input.orderId);
    if (!order) {
      throw createHttpError(404, "Order not found");
    }
    return order;
  },
});

const orderWithPaidFlagSchema = orderWithContactSchema.extend({
  paidInFull: z.boolean(),
});

export const getFarmOrdersEndpoint = membershipEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(orderWithPaidFlagSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { orders, farmId } }) => {
    const rawResult = await orders.getOrdersForFarm(farmId);
    const result = rawResult.map((order) => {
      const orderTotal = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
      return { ...order, paidInFull: totalPaid >= orderTotal };
    });
    return {
      result,
      count: result.length,
    };
  },
});

export const getContactOrdersEndpoint = membershipEndpointFactory.build({
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

export const getOrderItemsEndpoint = membershipEndpointFactory.build({
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

export const createOrderEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: z.object({
    contactId: z.string(),
    orderDate: ez.dateIn(),
    shippingDate: ez.dateIn().optional(),
    notes: z.string().optional(),
    status: z.enum(["pending", "confirmed"]).optional(),
    items: z.array(orderItemInputSchema).min(1),
  }),
  output: orderWithRelationsSchema,
  handler: async ({ input, ctx: { orders } }) => {
    const { items, ...orderData } = input;
    return orders.createOrder(orderData, items);
  },
});

export const confirmOrderEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: z.object({ orderId: z.string() }),
  output: orderSchema,
  handler: async ({ input, ctx: { orders } }) => {
    return orders.confirmOrder(input.orderId);
  },
});

export const fulfillOrderEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: z.object({ orderId: z.string() }),
  output: orderSchema,
  handler: async ({ input, ctx: { orders } }) => {
    return orders.fulfillOrder(input.orderId);
  },
});

export const cancelOrderEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: z.object({ orderId: z.string() }),
  output: orderSchema,
  handler: async ({ input, ctx: { orders } }) => {
    return orders.cancelOrder(input.orderId);
  },
});

export const updateOrderEndpoint = membershipEndpointFactory.build({
  method: "patch",
  input: z.object({
    orderId: z.string(),
    notes: z.string().optional(),
    shippingDate: ez.dateIn().optional(),
  }),
  output: orderSchema,
  handler: async ({ input, ctx: { orders } }) => {
    const { orderId, ...data } = input;
    return orders.updateOrderNotes(orderId, data);
  },
});

export const addOrderItemEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: z.object({
    orderId: z.string(),
    productId: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative().optional(),
  }),
  output: orderItemWithProductSchema,
  handler: async ({ input, ctx: { orders } }) => {
    const { orderId, ...item } = input;
    return orders.addOrderItem(orderId, item);
  },
});

export const updateOrderItemEndpoint = membershipEndpointFactory.build({
  method: "patch",
  input: z.object({
    orderId: z.string(),
    orderItemId: z.string(),
    quantity: z.number().positive().optional(),
    unitPrice: z.number().nonnegative().optional(),
  }),
  output: orderItemSchema,
  handler: async ({ input, ctx: { orders } }) => {
    const { orderItemId, ...data } = input;
    return orders.updateOrderItem(orderItemId, data);
  },
});

export const removeOrderItemEndpoint = membershipEndpointFactory.build({
  method: "delete",
  input: z.object({ orderId: z.string(), orderItemId: z.string() }),
  output: z.object({ success: z.boolean() }),
  handler: async ({ input, ctx: { orders } }) => {
    await orders.removeOrderItem(input.orderItemId);
    return { success: true };
  },
});
