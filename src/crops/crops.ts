import { count, eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import {
  farmIdColumnValue,
  crops,
  cropRotations,
  harvests,
} from "../db/schema";

export type CropCreateInput = Omit<typeof crops.$inferInsert, "id" | "farmId">;
export type CropUpdateInput = Partial<CropCreateInput>;
export type Crop = typeof crops.$inferSelect;

export function cropApi(rlsDb: RlsDb) {
  return {
    async createCrop(cropInput: CropCreateInput): Promise<Crop> {
      return rlsDb.rls(async (tx) => {
        const [crop] = await tx
          .insert(crops)
          .values({ ...farmIdColumnValue, ...cropInput })
          .returning();
        return crop;
      });
    },
    async getCropById(id: string): Promise<Crop | undefined> {
      return rlsDb.rls(async (tx) => {
        const [crop] = await tx.select().from(crops).where(eq(crops.id, id));
        return crop;
      });
    },
    async geCropsForFarm(farmId: string): Promise<Crop[]> {
      return rlsDb.rls(async (tx) => {
        return tx.select().from(crops).where(eq(crops.farmId, farmId));
      });
    },
    async updateCrop(id: string, data: CropUpdateInput): Promise<Crop> {
      return rlsDb.rls(async (tx) => {
        const [crop] = await tx
          .update(crops)
          .set(data)
          .where(eq(crops.id, id))
          .returning();
        return crop;
      });
    },
    async deleteCrop(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(crops).where(eq(crops.id, id));
      });
    },
    async cropInUse(id: string): Promise<boolean> {
      return rlsDb.rls(async (tx) => {
        const [cropRotationResult] = await tx
          .select({ count: count() })
          .from(cropRotations)
          .where(eq(cropRotations.cropId, id));
        const [harvestResult] = await tx
          .select({ count: count() })
          .from(harvests)
          .where(eq(harvests.cropId, id));
        return cropRotationResult.count > 0 || harvestResult.count > 0;
      });
    },
  };
}
