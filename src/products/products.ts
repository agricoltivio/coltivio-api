import { eq, and } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { products } from "../db/schema";

export type ProductCreateInput = Omit<typeof products.$inferInsert, "id" | "farmId">;
export type ProductUpdateInput = Partial<ProductCreateInput>;
export type Product = typeof products.$inferSelect;

export async function createProduct(productInput: ProductCreateInput, farmId: string): Promise<Product> {
  const [product] = await appDrizzle
    .insert(products)
    .values({ farmId, ...productInput })
    .returning();
  return product;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const [product] = await appDrizzle.select().from(products).where(eq(products.id, id));
  return product;
}

export async function getProductsForFarm(farmId: string): Promise<Product[]> {
  return appDrizzle.select().from(products).where(eq(products.farmId, farmId));
}

export async function getActiveProductsForFarm(farmId: string): Promise<Product[]> {
  return appDrizzle
    .select()
    .from(products)
    .where(and(eq(products.farmId, farmId), eq(products.active, true)));
}

export async function updateProduct(id: string, data: ProductUpdateInput): Promise<Product> {
  const [product] = await appDrizzle.update(products).set(data).where(eq(products.id, id)).returning();
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  await appDrizzle.delete(products).where(eq(products.id, id));
}
