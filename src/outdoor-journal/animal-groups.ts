import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { animalGroups, farmIdColumnValue } from "../db/schema";

export type AnimalGroup = typeof animalGroups.$inferSelect;
export type AnimalGroupCreateInput = Omit<typeof animalGroups.$inferInsert, "id" | "farmId">;
export type AnimalGroupUpdateInput = Partial<AnimalGroupCreateInput>;

export function animalGroupsApi(rlsDb: RlsDb) {
  return {
    async create(input: AnimalGroupCreateInput): Promise<AnimalGroup> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .insert(animalGroups)
          .values({ ...farmIdColumnValue, ...input })
          .returning();
        return result;
      });
      return result;
    },

    async getForFarm(farmId: string): Promise<AnimalGroup[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.animalGroups.findMany({
          where: { farmId },
        });
      });
    },

    async getById(id: string): Promise<AnimalGroup | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.animalGroups.findFirst({
          where: { id },
        });
      });
    },

    async update(id: string, data: AnimalGroupUpdateInput): Promise<AnimalGroup> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .update(animalGroups)
          .set(data)
          .where(eq(animalGroups.id, id))
          .returning();
        return result;
      });
      return result;
    },

    async delete(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(animalGroups).where(eq(animalGroups.id, id));
      });
    },
  };
}
