import { count, eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { fertilizerApplications, fertilizers } from "../db/schema";

export type FertilizerCreateInput = Omit<typeof fertilizers.$inferInsert, "id" | "farmId">;
export type FertilizerUpdateInput = Partial<FertilizerCreateInput>;
export type Fertilizer = typeof fertilizers.$inferSelect;

export async function createFertilizer(fertilizerInput: FertilizerCreateInput, farmId: string): Promise<Fertilizer> {
  const [fertilizer] = await appDrizzle
    .insert(fertilizers)
    .values({ farmId, ...fertilizerInput })
    .returning();
  return fertilizer;
}

export async function getFertilizerById(id: string): Promise<Fertilizer | undefined> {
  const [fertilizer] = await appDrizzle.select().from(fertilizers).where(eq(fertilizers.id, id));
  return fertilizer;
}

export async function getFertilizersForFarm(farmId: string): Promise<Fertilizer[]> {
  return appDrizzle.select().from(fertilizers).where(eq(fertilizers.farmId, farmId));
}

export async function updateFertilizer(id: string, data: FertilizerUpdateInput): Promise<Fertilizer> {
  const [fertilizer] = await appDrizzle.update(fertilizers).set(data).where(eq(fertilizers.id, id)).returning();
  return fertilizer;
}

export async function deleteFertilizer(id: string): Promise<void> {
  await appDrizzle.delete(fertilizers).where(eq(fertilizers.id, id));
}

export async function fertilizerInUse(id: string): Promise<boolean> {
  const [result] = await appDrizzle
    .select({ count: count() })
    .from(fertilizerApplications)
    .where(eq(fertilizerApplications.fertilizerId, id));
  return result.count > 0;
}
