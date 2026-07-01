import { and, eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { profiles } from "../db/schema";

export type NewUser = typeof profiles.$inferInsert;
export type UpdatedUser = Partial<NewUser>;
export type User = typeof profiles.$inferSelect;

export async function createUser(newUser: NewUser): Promise<User> {
  const [user] = await appDrizzle.insert(profiles).values(newUser).returning();
  return user;
}

export async function getUserById(id: string, farmId: string): Promise<User | undefined> {
  const [user] = await appDrizzle
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, id), eq(profiles.farmId, farmId)));
  return user;
}

export async function updateUser(id: string, updatedUser: UpdatedUser): Promise<User> {
  const [user] = await appDrizzle.update(profiles).set(updatedUser).where(eq(profiles.id, id)).returning();
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  await appDrizzle.delete(profiles).where(eq(profiles.id, id));
}
