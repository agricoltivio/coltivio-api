import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { contacts, farmIdColumnValue } from "../db/schema";

export type ContactCreateInput = Omit<
  typeof contacts.$inferInsert,
  "id" | "farmId"
>;
export type ContactUpdateInput = Partial<ContactCreateInput>;
export type Contact = typeof contacts.$inferSelect;

export function contactsApi(rlsDb: RlsDb) {
  return {
    async createContact(contactInput: ContactCreateInput): Promise<Contact> {
      return rlsDb.rls(async (tx) => {
        const [contact] = await tx
          .insert(contacts)
          .values({ ...farmIdColumnValue, ...contactInput })
          .returning();
        return contact;
      });
    },

    async getContactById(id: string): Promise<Contact | undefined> {
      return rlsDb.rls(async (tx) => {
        const [contact] = await tx
          .select()
          .from(contacts)
          .where(eq(contacts.id, id));
        return contact;
      });
    },

    async getContactsForFarm(farmId: string): Promise<Contact[]> {
      return rlsDb.rls(async (tx) => {
        return tx.select().from(contacts).where(eq(contacts.farmId, farmId));
      });
    },

    async updateContact(
      id: string,
      data: ContactUpdateInput,
    ): Promise<Contact> {
      return rlsDb.rls(async (tx) => {
        const [contact] = await tx
          .update(contacts)
          .set(data)
          .where(eq(contacts.id, id))
          .returning();
        return contact;
      });
    },

    async deleteContact(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(contacts).where(eq(contacts.id, id));
      });
    },
  };
}
