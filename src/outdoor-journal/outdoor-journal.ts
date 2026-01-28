import { and, eq, gte, lte } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { outdoorJournalEntries, farmIdColumnValue } from "../db/schema";
import { AnimalGroup } from "./animal-groups";

export type OutdoorJournalEntry = typeof outdoorJournalEntries.$inferSelect;
export type OutdoorJournalEntryWithGroup = OutdoorJournalEntry & {
  animalGroup: AnimalGroup;
};
export type OutdoorJournalEntryCreateInput = Omit<typeof outdoorJournalEntries.$inferInsert, "id" | "farmId">;
export type OutdoorJournalEntryUpdateInput = Partial<OutdoorJournalEntryCreateInput>;

export function outdoorJournalApi(rlsDb: RlsDb) {
  return {
    async create(input: OutdoorJournalEntryCreateInput): Promise<OutdoorJournalEntryWithGroup> {
      const result = await rlsDb.rls(async (tx) => {
        const [result] = await tx
          .insert(outdoorJournalEntries)
          .values({ ...farmIdColumnValue, ...input })
          .returning();
        return result;
      });
      // Fetch with relation
      const entry = await rlsDb.rls(async (tx) => {
        return tx.query.outdoorJournalEntries.findFirst({
          where: { id: result.id },
          with: { animalGroup: true },
        });
      });
      return entry!;
    },

    async getForFarm(farmId: string): Promise<OutdoorJournalEntryWithGroup[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.outdoorJournalEntries.findMany({
          where: { farmId },
          with: { animalGroup: true },
        });
      });
    },

    async getById(id: string): Promise<OutdoorJournalEntryWithGroup | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.outdoorJournalEntries.findFirst({
          where: { id },
          with: { animalGroup: true },
        });
      });
    },

    // Get entries that overlap with the given date range (for calendar view)
    // An entry overlaps if: entry.startDate <= to AND entry.endDate >= from
    async getByDateRange(farmId: string, from: Date, to: Date): Promise<OutdoorJournalEntryWithGroup[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.outdoorJournalEntries.findMany({
          where: {
            farmId,
            startDate: { lte: to },
            endDate: { gte: from },
          },
          with: { animalGroup: true },
        });
      });
    },

    async update(id: string, data: OutdoorJournalEntryUpdateInput): Promise<OutdoorJournalEntryWithGroup> {
      await rlsDb.rls(async (tx) => {
        await tx
          .update(outdoorJournalEntries)
          .set(data)
          .where(eq(outdoorJournalEntries.id, id));
      });
      // Fetch with relation
      const entry = await rlsDb.rls(async (tx) => {
        return tx.query.outdoorJournalEntries.findFirst({
          where: { id },
          with: { animalGroup: true },
        });
      });
      return entry!;
    },

    async delete(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(outdoorJournalEntries).where(eq(outdoorJournalEntries.id, id));
      });
    },
  };
}
