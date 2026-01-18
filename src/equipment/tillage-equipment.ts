import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { farmIdColumnValue, tillageEquipment } from "../db/schema";

export type TillageEquipmentCreateInput = Omit<
  typeof tillageEquipment.$inferInsert,
  "id" | "farmId"
>;
export type TillageEquipment = typeof tillageEquipment.$inferSelect;

export type TillageEquipmentUpdateInput = Partial<TillageEquipmentCreateInput>;

export function tillageEquipmentApi(rlsDb: RlsDb) {
  return {
    async createTillageEquipment(
      input: TillageEquipmentCreateInput
    ): Promise<TillageEquipment> {
      return rlsDb.rls(async (tx) => {
        const [equipment] = await tx
          .insert(tillageEquipment)
          .values({ ...farmIdColumnValue, ...input })
          .returning();
        return equipment;
      });
    },
    async getTillageEquipmentById(
      id: string
    ): Promise<TillageEquipment | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.tillageEquipment.findFirst({
          where: { id },
        });
      });
    },
    async getTillageEquipmentForFarm(
      farmId: string
    ): Promise<TillageEquipment[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.tillageEquipment.findMany({
          where: { farmId },
          orderBy: { name: "asc" },
        });
      });
    },
    async updateTillageEquipment(
      id: string,
      data: TillageEquipmentUpdateInput
    ): Promise<TillageEquipment> {
      const result = await rlsDb.rls(async (tx) => {
        const [equipment] = await tx
          .update(tillageEquipment)
          .set(data)
          .where(eq(tillageEquipment.id, id))
          .returning();
        return equipment;
      });
      const entity = await this.getTillageEquipmentById(result.id);
      return entity!;
    },
    async deleteTillageEquipment(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(tillageEquipment).where(eq(tillageEquipment.id, id));
      });
    },
  };
}
