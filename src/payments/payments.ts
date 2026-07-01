import { eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { payments } from "../db/schema";
import { Contact } from "../contacts/contacts";
import { Sponsorship } from "../sponsorships/sponsorships";
import { Order } from "../orders/orders";

export type PaymentCreateInput = Omit<typeof payments.$inferInsert, "id" | "farmId">;
export type PaymentUpdateInput = Partial<PaymentCreateInput>;
export type Payment = typeof payments.$inferSelect;

export type PaymentWithRelations = Payment & {
  contact: Contact;
  sponsorship: Sponsorship | null;
  order: Order | null;
};

export async function createPayment(paymentInput: PaymentCreateInput, farmId: string): Promise<Payment> {
  const [payment] = await appDrizzle
    .insert(payments)
    .values({ farmId, ...paymentInput })
    .returning();
  return payment;
}

export async function getPaymentById(id: string): Promise<PaymentWithRelations | undefined> {
  return appDrizzle.query.payments.findFirst({
    where: { id },
    with: { contact: true, sponsorship: true, order: true },
  });
}

export async function getPaymentsForFarm(farmId: string): Promise<PaymentWithRelations[]> {
  return appDrizzle.query.payments.findMany({
    where: { farmId },
    with: { contact: true, sponsorship: true, order: true },
  });
}

export async function getPaymentsForContact(contactId: string): Promise<Omit<PaymentWithRelations, "contact">[]> {
  return appDrizzle.query.payments.findMany({
    where: { contactId },
    with: { sponsorship: true, order: true },
  });
}

export async function getPaymentsForOrder(orderId: string): Promise<Payment[]> {
  return appDrizzle.select().from(payments).where(eq(payments.orderId, orderId));
}

export async function updatePayment(id: string, data: PaymentUpdateInput): Promise<Payment> {
  const [payment] = await appDrizzle.update(payments).set(data).where(eq(payments.id, id)).returning();
  return payment;
}

export async function getPaymentsForSponsorship(sponsorshipId: string): Promise<Payment[]> {
  return appDrizzle.select().from(payments).where(eq(payments.sponsorshipId, sponsorshipId));
}

export async function deletePayment(id: string): Promise<void> {
  await appDrizzle.delete(payments).where(eq(payments.id, id));
}
