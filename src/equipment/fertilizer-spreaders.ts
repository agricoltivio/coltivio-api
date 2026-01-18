import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import {
  farmIdColumnValue,
  fertilizerSpreaders,
  fertilizers,
} from "../db/schema";

export type FertilizerSpreaderCreateInput = Omit<
  typeof fertilizerSpreaders.$inferInsert,
  "id" | "farmId"
>;
export type FertilizerSpreaderUpdateInput =
  Partial<FertilizerSpreaderCreateInput>;
export type FertilizerSpreader = typeof fertilizerSpreaders.$inferSelect;

export function fertilizerSpreaderApi(rlsDb: RlsDb) {
  return {
    async createFertilizerSpreader(
      fertilizerSpreaderInput: FertilizerSpreaderCreateInput
    ): Promise<FertilizerSpreader> {
      const result = await rlsDb.rls(async (tx) => {
        const [fertilizerSpreader] = await tx
          .insert(fertilizerSpreaders)
          .values({
            ...farmIdColumnValue,
            ...fertilizerSpreaderInput,
          })
          .returning({ id: fertilizerSpreaders.id });
        return fertilizerSpreader;
      });
      const entity = await this.getFertilizerSpreaderById(result.id);
      return entity!;
    },
    async getFertilizerSpreaderById(
      id: string
    ): Promise<FertilizerSpreader | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.fertilizerSpreaders.findFirst({
          where: { id },
        });
      });
    },
    async getFertilizerSpreadersForFarm(
      farmId: string
    ): Promise<FertilizerSpreader[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.fertilizerSpreaders.findMany({
          where: { farmId },
        });
      });
    },
    async updateFertilizerSpreader(
      id: string,
      data: FertilizerSpreaderUpdateInput
    ): Promise<FertilizerSpreader> {
      const result = await rlsDb.rls(async (tx) => {
        // we need to remove this spreader as default when the unit changes
        const currentUnit = await tx.query.fertilizerSpreaders.findFirst({
          where: { id },
          columns: { unit: true },
        });
        if (data.unit != null && currentUnit?.unit !== data.unit) {
          await tx
            .update(fertilizers)
            .set({ defaultSpreaderId: null })
            .where(eq(fertilizers.defaultSpreaderId, id));
        }

        const [fertilizerSpreader] = await tx
          .update(fertilizerSpreaders)
          .set(data)
          .where(eq(fertilizerSpreaders.id, id))
          .returning({ id: fertilizerSpreaders.id });
        return fertilizerSpreader;
      });
      const entity = await this.getFertilizerSpreaderById(result.id);
      return entity!;
    },
    async deleteFertilizerSpreader(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx
          .delete(fertilizerSpreaders)
          .where(eq(fertilizerSpreaders.id, id));
      });
    },
  };
}
