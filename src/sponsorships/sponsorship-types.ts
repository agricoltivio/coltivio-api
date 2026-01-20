import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { sponsorshipTypes, farmIdColumnValue } from "../db/schema";

export type SponsorshipTypeCreateInput = Omit<
  typeof sponsorshipTypes.$inferInsert,
  "id" | "farmId"
>;
export type SponsorshipTypeUpdateInput = Partial<SponsorshipTypeCreateInput>;
export type SponsorshipType = typeof sponsorshipTypes.$inferSelect;

export function sponsorshipTypesApi(rlsDb: RlsDb) {
  return {
    async createSponsorshipType(
      input: SponsorshipTypeCreateInput,
    ): Promise<SponsorshipType> {
      return rlsDb.rls(async (tx) => {
        const [sponsorshipType] = await tx
          .insert(sponsorshipTypes)
          .values({ ...farmIdColumnValue, ...input })
          .returning();
        return sponsorshipType;
      });
    },

    async getSponsorshipTypeById(
      id: string,
    ): Promise<SponsorshipType | undefined> {
      return rlsDb.rls(async (tx) => {
        const [sponsorshipType] = await tx
          .select()
          .from(sponsorshipTypes)
          .where(eq(sponsorshipTypes.id, id));
        return sponsorshipType;
      });
    },

    async getSponsorshipTypesForFarm(
      farmId: string,
    ): Promise<SponsorshipType[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(sponsorshipTypes)
          .where(eq(sponsorshipTypes.farmId, farmId));
      });
    },

    async updateSponsorshipType(
      id: string,
      data: SponsorshipTypeUpdateInput,
    ): Promise<SponsorshipType> {
      return rlsDb.rls(async (tx) => {
        const [sponsorshipType] = await tx
          .update(sponsorshipTypes)
          .set(data)
          .where(eq(sponsorshipTypes.id, id))
          .returning();
        return sponsorshipType;
      });
    },

    async deleteSponsorshipType(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(sponsorshipTypes).where(eq(sponsorshipTypes.id, id));
      });
    },
  };
}
