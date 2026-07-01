import { count, eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { cropProtectionProducts, cropProtectionApplications } from "../db/schema";

export type CropProtectionProductCreateInput = Omit<typeof cropProtectionProducts.$inferInsert, "id" | "farmId">;
export type CropProtectionProductUpdateInput = Partial<CropProtectionProductCreateInput>;
export type CropProtectionProduct = typeof cropProtectionProducts.$inferSelect;

export async function createCropProtectionProduct(
  cropProtectionProductInput: CropProtectionProductCreateInput,
  farmId: string
): Promise<CropProtectionProduct> {
  const [cropProtectionProduct] = await appDrizzle
    .insert(cropProtectionProducts)
    .values({ farmId, ...cropProtectionProductInput })
    .returning();
  return cropProtectionProduct;
}

export async function getCropProtectionProductById(id: string): Promise<CropProtectionProduct | undefined> {
  const [cropProtectionProduct] = await appDrizzle
    .select()
    .from(cropProtectionProducts)
    .where(eq(cropProtectionProducts.id, id));
  return cropProtectionProduct;
}

export async function getCropProtectionProductsForFarm(farmId: string): Promise<CropProtectionProduct[]> {
  return appDrizzle.select().from(cropProtectionProducts).where(eq(cropProtectionProducts.farmId, farmId));
}

export async function updateCropProtectionProduct(
  id: string,
  data: CropProtectionProductUpdateInput
): Promise<CropProtectionProduct> {
  const [cropProtectionProduct] = await appDrizzle
    .update(cropProtectionProducts)
    .set(data)
    .where(eq(cropProtectionProducts.id, id))
    .returning();
  return cropProtectionProduct;
}

export async function deleteCropProtectionProduct(id: string): Promise<void> {
  await appDrizzle.delete(cropProtectionProducts).where(eq(cropProtectionProducts.id, id));
}

export async function cropProtectionProductInUse(id: string): Promise<boolean> {
  const [result] = await appDrizzle
    .select({ count: count() })
    .from(cropProtectionApplications)
    .where(eq(cropProtectionApplications.productId, id));
  return result.count > 0;
}
