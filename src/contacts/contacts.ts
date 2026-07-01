import { eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { contacts } from "../db/schema";
import { Payment } from "../payments/payments";
import { SponsorshipWithRelations } from "../sponsorships/sponsorships";
import { Order } from "../orders/orders";
import { Animal } from "../animals/animals";

export type ContactCreateInput = Omit<typeof contacts.$inferInsert, "id" | "farmId">;
export type ContactUpdateInput = Partial<ContactCreateInput>;
export type Contact = typeof contacts.$inferSelect;

export type ContactWithRelations = Contact & {
  payments: Payment[];
  sponsorships: Array<
    Omit<
      Omit<SponsorshipWithRelations, "animal"> & {
        animal: Omit<Animal, "earTag">;
      },
      "contact" | "payments"
    >
  >;
  orders: Order[];
};

export async function createContact(contactInput: ContactCreateInput, farmId: string): Promise<Contact> {
  const [contact] = await appDrizzle
    .insert(contacts)
    .values({ farmId, ...contactInput })
    .returning();
  return contact;
}

export async function getContactById(id: string): Promise<ContactWithRelations | undefined> {
  return appDrizzle.query.contacts.findFirst({
    where: { id },
    with: {
      payments: true,
      sponsorships: {
        with: {
          animal: true,
          sponsorshipProgram: true,
        },
      },
      orders: true,
    },
  });
}

export async function getContactsForFarm(farmId: string): Promise<Contact[]> {
  return appDrizzle.select().from(contacts).where(eq(contacts.farmId, farmId));
}

export async function updateContact(id: string, data: ContactUpdateInput): Promise<Contact> {
  const [contact] = await appDrizzle.update(contacts).set(data).where(eq(contacts.id, id)).returning();
  return contact;
}

export async function deleteContact(id: string): Promise<void> {
  await appDrizzle.delete(contacts).where(eq(contacts.id, id));
}
