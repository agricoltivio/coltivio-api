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
          where: eq(fertilizerSpreaders.id, id),
        });
      });
    },
    async getFertilizerSpreadersForFarm(
      farmId: string
    ): Promise<FertilizerSpreader[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.fertilizerSpreaders.findMany({
          where: eq(fertilizerSpreaders.farmId, farmId),
        });
      });
    },
    async updateFertilizerSpreader(
      id: string,
      data: FertilizerSpreaderUpdateInput
    ): Promise<FertilizerSpreader> {
      const result = await rlsDb.rls(async (tx) => {
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
