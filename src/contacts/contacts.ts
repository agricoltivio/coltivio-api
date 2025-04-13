// import { db } from "../db/db";
// import { eq } from "drizzle-orm";
// import { contacts } from "../db/schema";

// export type NewContact = typeof contacts.$inferInsert;
// export type UpdatedContact = Partial<NewContact>;
// export type Contact = typeof contacts.$inferSelect;

// export async function createContact(newContact: NewContact): Promise<Contact> {
//   const [contact] = await db.insert(contacts).values(newContact).returning();
//   return contact;
// }

// export async function getContactById(id: string): Promise<Contact> {
//   const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
//   if (!contact) {
//     throw new Error(`Contact with id ${id} not found`);
//   }
//   return contact;
// }

// export async function getContactsForFarm(farmId: string): Promise<Contact[]> {
//   return db.select().from(contacts).where(eq(contacts.farmId, farmId));
// }

// export async function updateContact(
//   id: string,
//   updatedContact: UpdatedContact
// ): Promise<Contact> {
//   const [contact] = await db
//     .update(contacts)
//     .set(updatedContact)
//     .where(eq(contacts.id, id))
//     .returning();
//   return contact;
// }

// export async function deleteContact(id: string): Promise<void> {
//   await db.delete(contacts).where(eq(contacts.id, id));
// }
