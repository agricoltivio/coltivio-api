import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { payments, farmIdColumnValue } from "../db/schema";

export type PaymentCreateInput = Omit<
  typeof payments.$inferInsert,
  "id" | "farmId"
>;
export type PaymentUpdateInput = Partial<PaymentCreateInput>;
export type Payment = typeof payments.$inferSelect;

export function paymentsApi(rlsDb: RlsDb) {
  return {
    async createPayment(paymentInput: PaymentCreateInput): Promise<Payment> {
      return rlsDb.rls(async (tx) => {
        const [payment] = await tx
          .insert(payments)
          .values({ ...farmIdColumnValue, ...paymentInput })
          .returning();
        return payment;
      });
    },

    async getPaymentById(id: string): Promise<Payment | undefined> {
      return rlsDb.rls(async (tx) => {
        const [payment] = await tx
          .select()
          .from(payments)
          .where(eq(payments.id, id));
        return payment;
      });
    },

    async getPaymentsForFarm(farmId: string): Promise<Payment[]> {
      return rlsDb.rls(async (tx) => {
        return tx.select().from(payments).where(eq(payments.farmId, farmId));
      });
    },

    async getPaymentsForContact(contactId: string): Promise<Payment[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(payments)
          .where(eq(payments.contactId, contactId));
      });
    },

    async updatePayment(
      id: string,
      data: PaymentUpdateInput,
    ): Promise<Payment> {
      return rlsDb.rls(async (tx) => {
        const [payment] = await tx
          .update(payments)
          .set(data)
          .where(eq(payments.id, id))
          .returning();
        return payment;
      });
    },

    async deletePayment(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(payments).where(eq(payments.id, id));
      });
    },
  };
}
