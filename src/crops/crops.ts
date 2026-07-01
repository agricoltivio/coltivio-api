import { count, eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { crops, cropFamilies, cropRotations, harvests } from "../db/schema";

export type CropCreateInput = Omit<typeof crops.$inferInsert, "id" | "farmId">;
export type CropUpdateInput = Partial<CropCreateInput>;
export type Crop = typeof crops.$inferSelect & {
  family: typeof cropFamilies.$inferSelect | null;
};

export type CropFamilyCreateInput = Omit<typeof cropFamilies.$inferInsert, "id" | "farmId">;
export type CropFamilyUpdateInput = Partial<CropFamilyCreateInput>;
export type CropFamily = typeof cropFamilies.$inferSelect;

export async function createCrop(cropInput: CropCreateInput, farmId: string): Promise<Crop> {
  const [result] = await appDrizzle
    .insert(crops)
    .values({ farmId, ...cropInput })
    .returning();
  const crop = await getCropById(result.id);
  return crop!;
}

export async function getCropById(id: string): Promise<Crop | undefined> {
  return appDrizzle.query.crops.findFirst({ where: { id }, with: { family: true } });
}

export async function getCropsForFarm(farmId: string): Promise<Crop[]> {
  return appDrizzle.query.crops.findMany({ where: { farmId }, with: { family: true } });
}

export async function updateCrop(id: string, data: CropUpdateInput): Promise<Crop> {
  await appDrizzle.update(crops).set(data).where(eq(crops.id, id));
  const crop = await getCropById(id);
  return crop!;
}

export async function deleteCrop(id: string): Promise<void> {
  await appDrizzle.delete(crops).where(eq(crops.id, id));
}

export async function cropInUse(id: string): Promise<boolean> {
  const [cropRotationResult] = await appDrizzle
    .select({ count: count() })
    .from(cropRotations)
    .where(eq(cropRotations.cropId, id));
  const [harvestResult] = await appDrizzle.select({ count: count() }).from(harvests).where(eq(harvests.cropId, id));
  return cropRotationResult.count > 0 || harvestResult.count > 0;
}

export async function createCropFamily(familyInput: CropFamilyCreateInput, farmId: string): Promise<CropFamily> {
  const [family] = await appDrizzle
    .insert(cropFamilies)
    .values({ farmId, ...familyInput })
    .returning();
  return family;
}

export async function getCropFamilyById(id: string): Promise<CropFamily | undefined> {
  return appDrizzle.query.cropFamilies.findFirst({ where: { id } });
}

export async function getCropFamiliesForFarm(farmId: string): Promise<CropFamily[]> {
  return appDrizzle.query.cropFamilies.findMany({ where: { farmId } });
}

export async function updateCropFamily(id: string, data: CropFamilyUpdateInput): Promise<CropFamily> {
  const [family] = await appDrizzle.update(cropFamilies).set(data).where(eq(cropFamilies.id, id)).returning();
  return family;
}

export async function deleteCropFamily(id: string): Promise<void> {
  await appDrizzle.delete(cropFamilies).where(eq(cropFamilies.id, id));
}

export async function cropFamilyInUse(id: string): Promise<boolean> {
  const [result] = await appDrizzle.select({ count: count() }).from(crops).where(eq(crops.familyId, id));
  return result.count > 0;
}
