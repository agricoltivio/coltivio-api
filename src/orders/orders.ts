import { eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { orderItems, orders } from "../db/schema";
import { Contact } from "../contacts/contacts";
import { Payment } from "../payments/payments";
import { Product } from "../products/products";

export type OrderCreateInput = Omit<typeof orders.$inferInsert, "id" | "farmId" | "status"> & {
  status?: "pending" | "confirmed";
};
export type OrderUpdateInput = { notes?: string | null; shippingDate?: Date | null };
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

export type OrderItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type OrderItemWithProduct = OrderItem & { product: Product };

export type OrderWithRelations = Order & {
  contact: Contact;
  items: OrderItemWithProduct[];
  payments: Payment[];
};

export async function createOrder(
  orderInput: OrderCreateInput,
  items: OrderItemInput[],
  farmId: string
): Promise<OrderWithRelations> {
  const result = await appDrizzle.transaction(async (tx) => {
    const productIds = items.map((item) => item.productId);
    const allProducts = await tx.query.products.findMany({ where: { id: { in: productIds } } });

    const [order] = await tx
      .insert(orders)
      .values({ farmId, ...orderInput, status: orderInput.status ?? "pending" })
      .returning({ id: orders.id });

    for (const item of items) {
      const product = allProducts.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      await tx.insert(orderItems).values({
        farmId,
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? product.pricePerUnit,
      });
    }

    return order;
  });

  const fullOrder = await getOrderById(result.id);
  return fullOrder!;
}

export async function getOrderById(id: string): Promise<OrderWithRelations | undefined> {
  return appDrizzle.query.orders.findFirst({
    where: { id },
    with: { contact: true, items: { with: { product: true } }, payments: true },
  });
}

export async function getOrdersForFarm(
  farmId: string
): Promise<Array<Order & { contact: Contact; items: OrderItemWithProduct[]; payments: Payment[] }>> {
  return appDrizzle.query.orders.findMany({
    where: { farmId },
    with: { contact: true, items: { with: { product: true } }, payments: true },
  });
}

export async function getOrdersForContact(contactId: string): Promise<Order[]> {
  return appDrizzle.select().from(orders).where(eq(orders.contactId, contactId));
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  return appDrizzle.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function confirmOrder(id: string): Promise<Order> {
  const [order] = await appDrizzle.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new Error(`Order not found: ${id}`);
  if (order.status !== "pending")
    throw new Error(`Cannot confirm order with status "${order.status}". Only pending orders can be confirmed.`);
  const [updated] = await appDrizzle.update(orders).set({ status: "confirmed" }).where(eq(orders.id, id)).returning();
  return updated;
}

export async function fulfillOrder(id: string): Promise<Order> {
  const [order] = await appDrizzle.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new Error(`Order not found: ${id}`);
  if (order.status !== "confirmed")
    throw new Error(`Cannot fulfill order with status "${order.status}". Only confirmed orders can be fulfilled.`);
  const [updated] = await appDrizzle.update(orders).set({ status: "fulfilled" }).where(eq(orders.id, id)).returning();
  return updated;
}

export async function cancelOrder(id: string): Promise<Order> {
  const [order] = await appDrizzle.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new Error(`Order not found: ${id}`);
  if (order.status === "cancelled") throw new Error("Order is already cancelled");
  if (order.status === "fulfilled") throw new Error("Cannot cancel a fulfilled order");
  const [updated] = await appDrizzle.update(orders).set({ status: "cancelled" }).where(eq(orders.id, id)).returning();
  return updated;
}

export async function updateOrderNotes(id: string, data: OrderUpdateInput): Promise<Order> {
  const [updated] = await appDrizzle.update(orders).set(data).where(eq(orders.id, id)).returning();
  return updated;
}

export async function addOrderItem(
  orderId: string,
  item: OrderItemInput,
  farmId: string
): Promise<OrderItemWithProduct> {
  const product = await appDrizzle.query.products.findFirst({ where: { id: item.productId } });
  if (!product) throw new Error(`Product not found: ${item.productId}`);

  const [inserted] = await appDrizzle
    .insert(orderItems)
    .values({
      farmId,
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? product.pricePerUnit,
    })
    .returning();
  return { ...inserted, product };
}

export async function updateOrderItem(
  orderItemId: string,
  data: { quantity?: number; unitPrice?: number }
): Promise<OrderItem> {
  const [updated] = await appDrizzle.update(orderItems).set(data).where(eq(orderItems.id, orderItemId)).returning();
  if (!updated) throw new Error(`Order item not found: ${orderItemId}`);
  return updated;
}

export async function removeOrderItem(orderItemId: string): Promise<void> {
  await appDrizzle.delete(orderItems).where(eq(orderItems.id, orderItemId));
}
