import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import {
  orders,
  orderItems,
  products,
  farmIdColumnValue,
} from "../db/schema";

export type OrderCreateInput = Omit<
  typeof orders.$inferInsert,
  "id" | "farmId" | "status"
>;
export type OrderUpdateInput = {
  notes?: string | null;
  shippingDate?: Date | null;
};
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

export type OrderItemInput = {
  productId: string;
  quantity: number;
};

export function ordersApi(rlsDb: RlsDb) {
  return {
    // Creates an order with items and decrements stock from products
    async createOrder(
      orderInput: OrderCreateInput,
      items: OrderItemInput[],
    ): Promise<Order> {
      return rlsDb.rls(async (tx) => {
        // First validate all products exist and have sufficient stock
        const productIds = items.map((item) => item.productId);
        const productRecords = await tx
          .select()
          .from(products)
          .where(eq(products.farmId, orderInput.contactId)); // This will be filtered by RLS anyway

        // Get all products for validation
        const allProducts = await Promise.all(
          productIds.map(async (productId) => {
            const [product] = await tx
              .select()
              .from(products)
              .where(eq(products.id, productId));
            return product;
          }),
        );

        // Validate stock availability
        for (let i = 0; i < items.length; i++) {
          const product = allProducts[i];
          const item = items[i];
          if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
          }
          if (product.stock < item.quantity) {
            throw new Error(
              `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
            );
          }
        }

        // Create the order
        const [order] = await tx
          .insert(orders)
          .values({ ...farmIdColumnValue, ...orderInput, status: "pending" })
          .returning();

        // Create order items and decrement stock
        for (let i = 0; i < items.length; i++) {
          const product = allProducts[i];
          const item = items[i];

          // Create order item with price snapshot
          await tx.insert(orderItems).values({
            ...farmIdColumnValue,
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product.pricePerUnit,
          });

          // Decrement stock
          await tx
            .update(products)
            .set({ stock: product.stock - item.quantity })
            .where(eq(products.id, item.productId));
        }

        return order;
      });
    },

    async getOrderById(id: string): Promise<Order | undefined> {
      return rlsDb.rls(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id));
        return order;
      });
    },

    async getOrdersForFarm(farmId: string): Promise<Order[]> {
      return rlsDb.rls(async (tx) => {
        return tx.select().from(orders).where(eq(orders.farmId, farmId));
      });
    },

    async getOrdersForContact(contactId: string): Promise<Order[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(orders)
          .where(eq(orders.contactId, contactId));
      });
    },

    async getOrderItems(orderId: string): Promise<OrderItem[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
      });
    },

    async confirmOrder(id: string): Promise<Order> {
      return rlsDb.rls(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id));
        if (!order) {
          throw new Error(`Order not found: ${id}`);
        }
        if (order.status !== "pending") {
          throw new Error(
            `Cannot confirm order with status "${order.status}". Only pending orders can be confirmed.`,
          );
        }
        const [updated] = await tx
          .update(orders)
          .set({ status: "confirmed" })
          .where(eq(orders.id, id))
          .returning();
        return updated;
      });
    },

    async fulfillOrder(id: string): Promise<Order> {
      return rlsDb.rls(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id));
        if (!order) {
          throw new Error(`Order not found: ${id}`);
        }
        if (order.status !== "confirmed") {
          throw new Error(
            `Cannot fulfill order with status "${order.status}". Only confirmed orders can be fulfilled.`,
          );
        }
        const [updated] = await tx
          .update(orders)
          .set({ status: "fulfilled" })
          .where(eq(orders.id, id))
          .returning();
        return updated;
      });
    },

    // Cancels order and restores stock to products
    async cancelOrder(id: string): Promise<Order> {
      return rlsDb.rls(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id));
        if (!order) {
          throw new Error(`Order not found: ${id}`);
        }
        if (order.status === "cancelled") {
          throw new Error("Order is already cancelled");
        }
        if (order.status === "fulfilled") {
          throw new Error("Cannot cancel a fulfilled order");
        }

        // Get order items to restore stock
        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, id));

        // Restore stock for each item
        for (const item of items) {
          const [product] = await tx
            .select()
            .from(products)
            .where(eq(products.id, item.productId));
          if (product) {
            await tx
              .update(products)
              .set({ stock: product.stock + item.quantity })
              .where(eq(products.id, item.productId));
          }
        }

        // Update order status
        const [updated] = await tx
          .update(orders)
          .set({ status: "cancelled" })
          .where(eq(orders.id, id))
          .returning();
        return updated;
      });
    },

    async updateOrderNotes(id: string, data: OrderUpdateInput): Promise<Order> {
      return rlsDb.rls(async (tx) => {
        const [order] = await tx
          .update(orders)
          .set(data)
          .where(eq(orders.id, id))
          .returning();
        return order;
      });
    },
  };
}
