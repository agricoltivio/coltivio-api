import { asc, eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { farmIdColumnValue, cropProtectionEquipment } from "../db/schema";

export type CropProtectionEquipmentCreateInput = Omit<
  typeof cropProtectionEquipment.$inferInsert,
  "id" | "farmId"
>;
export type CropProtectionEquipment =
  typeof cropProtectionEquipment.$inferSelect;

export type CropProtectionEquipmentUpdateInput =
  Partial<CropProtectionEquipmentCreateInput>;

export function cropProtectionEquipmentApi(rlsDb: RlsDb) {
  return {
    async createCropProtectionEquipment(
      input: CropProtectionEquipmentCreateInput
    ): Promise<CropProtectionEquipment> {
      return rlsDb.rls(async (tx) => {
        const [equipment] = await tx
          .insert(cropProtectionEquipment)
          .values({ ...farmIdColumnValue, ...input })
          .returning();
        return equipment;
      });
    },
    async getCropProtectionEquipmentById(
      id: string
    ): Promise<CropProtectionEquipment | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropProtectionEquipment.findFirst({
          where: eq(cropProtectionEquipment.id, id),
        });
      });
    },
    async getCropProtectionEquipmentsForFarm(
      farmId: string
    ): Promise<CropProtectionEquipment[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.cropProtectionEquipment.findMany({
          where: eq(cropProtectionEquipment.farmId, farmId),
          orderBy: asc(cropProtectionEquipment.name),
        });
      });
    },
    async updateCropProtectionEquipment(
      id: string,
      data: CropProtectionEquipmentUpdateInput
    ): Promise<CropProtectionEquipment> {
      const result = await rlsDb.rls(async (tx) => {
        const [equipment] = await tx
          .update(cropProtectionEquipment)
          .set(data)
          .where(eq(cropProtectionEquipment.id, id))
          .returning();
        return equipment;
      });
      const entity = await this.getCropProtectionEquipmentById(result.id);
      return entity!;
    },
    async deleteCropProtectionEquipment(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx
          .delete(cropProtectionEquipment)
          .where(eq(cropProtectionEquipment.id, id));
      });
    },
  };
}
