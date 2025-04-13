import { asc, eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { farmIdColumnValue, harvestingMachinery } from "../db/schema";

export type HarvestingMachineryCreateInput = Omit<
  typeof harvestingMachinery.$inferInsert,
  "id" | "farmId"
>;
export type HarvestingMachineryUpdateInput =
  Partial<HarvestingMachineryCreateInput>;
export type HarvestingMachinery = typeof harvestingMachinery.$inferSelect;
export function harvestingMachineryApi(rlsDb: RlsDb) {
  return {
    async createHarvestingMachinery(
      harvestingMachineryInput: HarvestingMachineryCreateInput
    ): Promise<HarvestingMachinery> {
      return rlsDb.rls(async (tx) => {
        if (harvestingMachineryInput.default) {
          await tx.update(harvestingMachinery).set({ default: false });
        }
        const [machinery] = await tx
          .insert(harvestingMachinery)
          .values({ ...farmIdColumnValue, ...harvestingMachineryInput })
          .returning();
        return machinery;
      });
    },
    async getHarvestingMachineryById(
      id: string
    ): Promise<HarvestingMachinery | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.harvestingMachinery.findFirst({
          where: eq(harvestingMachinery.id, id),
        });
      });
    },
    async getHarvestingMachineryForFarm(
      farmId: string
    ): Promise<HarvestingMachinery[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.harvestingMachinery.findMany({
          where: eq(harvestingMachinery.farmId, farmId),
          orderBy: asc(harvestingMachinery.name),
        });
      });
    },
    async updateHarvestingMachinery(
      id: string,
      data: HarvestingMachineryUpdateInput
    ): Promise<HarvestingMachinery> {
      const result = await rlsDb.rls(async (tx) => {
        if (data.default) {
          await tx.update(harvestingMachinery).set({ default: false });
        }
        const [machinery] = await tx
          .update(harvestingMachinery)
          .set(data)
          .where(eq(harvestingMachinery.id, id))
          .returning();
        return machinery;
      });
      const entity = await this.getHarvestingMachineryById(result.id);
      return entity!;
    },
    async deleteHarvestingMachinery(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx
          .delete(harvestingMachinery)
          .where(eq(harvestingMachinery.id, id));
      });
    },
  };
}
