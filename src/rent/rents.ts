// import { db } from "../db/db";
// import { eq } from "drizzle-orm";
// import { rents } from "../db/schema";

// export type NewRent = typeof rents.$inferInsert;
// export type UpdatedRent = Partial<NewRent>;
// export type Rent = typeof rents.$inferSelect;

// export async function createRent(newRent: NewRent): Promise<Rent> {
//   const [rent] = await db.insert(rents).values(newRent).returning();
//   return rent;
// }

// export async function getRentById(id: string): Promise<Rent> {
//   const [rent] = await db.select().from(rents).where(eq(rents.id, id));
//   if (!rent) {
//     throw new Error(`Rent with id ${id} not found`);
//   }
//   return rent;
// }

// export async function getRentsForFarm(farmId: string): Promise<Rent[]> {
//   return db.select().from(rents).where(eq(rents.farmId, farmId));
// }

// export async function getRentForParcel(parcelId: string) {
//   return db.query.rents.findFirst({
//     where: eq(rents.parcelId, parcelId),
//   });
// }

// export async function updateRent(
//   id: string,
//   updatedRent: UpdatedRent
// ): Promise<Rent> {
//   const [rent] = await db
//     .update(rents)
//     .set(updatedRent)
//     .where(eq(rents.id, id))
//     .returning();
//   return rent;
// }

// export async function deleteRent(id: string): Promise<void> {
//   await db.delete(rents).where(eq(rents.id, id));
// }
