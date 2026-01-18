import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { sponsorships, payments, farmIdColumnValue } from "../db/schema";

export type SponsorshipCreateInput = Omit<
  typeof sponsorships.$inferInsert,
  "id" | "farmId"
>;
export type SponsorshipUpdateInput = Partial<SponsorshipCreateInput>;
export type Sponsorship = typeof sponsorships.$inferSelect;
export type Payment = typeof payments.$inferSelect;

export function sponsorshipsApi(rlsDb: RlsDb) {
  return {
    async createSponsorship(
      sponsorshipInput: SponsorshipCreateInput,
    ): Promise<Sponsorship> {
      return rlsDb.rls(async (tx) => {
        const [sponsorship] = await tx
          .insert(sponsorships)
          .values({ ...farmIdColumnValue, ...sponsorshipInput })
          .returning();
        return sponsorship;
      });
    },

    async getSponsorshipById(id: string): Promise<Sponsorship | undefined> {
      return rlsDb.rls(async (tx) => {
        const [sponsorship] = await tx
          .select()
          .from(sponsorships)
          .where(eq(sponsorships.id, id));
        return sponsorship;
      });
    },

    async getSponsorshipsForFarm(farmId: string): Promise<Sponsorship[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(sponsorships)
          .where(eq(sponsorships.farmId, farmId));
      });
    },

    async getSponsorshipsForContact(contactId: string): Promise<Sponsorship[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(sponsorships)
          .where(eq(sponsorships.contactId, contactId));
      });
    },

    async getSponsorshipsForAnimal(animalId: string): Promise<Sponsorship[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(sponsorships)
          .where(eq(sponsorships.animalId, animalId));
      });
    },

    async getPaymentsForSponsorship(sponsorshipId: string): Promise<Payment[]> {
      return rlsDb.rls(async (tx) => {
        return tx
          .select()
          .from(payments)
          .where(eq(payments.sponsorshipId, sponsorshipId));
      });
    },

    async updateSponsorship(
      id: string,
      data: SponsorshipUpdateInput,
    ): Promise<Sponsorship> {
      return rlsDb.rls(async (tx) => {
        const [sponsorship] = await tx
          .update(sponsorships)
          .set(data)
          .where(eq(sponsorships.id, id))
          .returning();
        return sponsorship;
      });
    },

    async deleteSponsorship(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(sponsorships).where(eq(sponsorships.id, id));
      });
    },
  };
}
