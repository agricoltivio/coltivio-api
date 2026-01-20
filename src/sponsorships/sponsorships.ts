import { eq } from "drizzle-orm";
import { RlsDb } from "../db/db";
import { sponsorships, payments, farmIdColumnValue } from "../db/schema";
import { Animal } from "../animals/animals";
import { Contact } from "../contacts/contacts";

export type SponsorshipCreateInput = Omit<
  typeof sponsorships.$inferInsert,
  "id" | "farmId"
>;
export type SponsorshipUpdateInput = Partial<SponsorshipCreateInput>;
export type Sponsorship = typeof sponsorships.$inferSelect & {
  animal: Omit<Animal, "earTag">;
  contact: Contact;
};
export type Payment = typeof payments.$inferSelect;

export function sponsorshipsApi(rlsDb: RlsDb) {
  return {
    async createSponsorship(
      sponsorshipInput: SponsorshipCreateInput,
    ): Promise<Sponsorship> {
      const result = await rlsDb.rls(async (tx) => {
        const [sponsorship] = await tx
          .insert(sponsorships)
          .values({ ...farmIdColumnValue, ...sponsorshipInput })
          .returning();
        return sponsorship;
      });
      const sponsorship = await this.getSponsorshipById(result.id);
      return sponsorship!;
    },

    async getSponsorshipById(id: string): Promise<Sponsorship | undefined> {
      return rlsDb.rls(async (tx) => {
        return tx.query.sponsorships.findFirst({
          where: { id },
          with: {
            animal: true,
            contact: true,
          },
        });
      });
    },

    async getSponsorshipsForFarm(
      farmId: string,
      onlyActive: boolean,
    ): Promise<Sponsorship[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.sponsorships.findMany({
          with: {
            animal: true,
            contact: true,
          },
          where: onlyActive
            ? {
                farmId,
                endDate: { OR: [{ gte: new Date() }, { isNull: true }] },
              }
            : { farmId },
        });
      });
    },

    async getSponsorshipsForContact(
      contactId: string,
      onlyActive: boolean,
    ): Promise<Sponsorship[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.sponsorships.findMany({
          with: {
            animal: true,
            contact: true,
          },
          where: onlyActive
            ? {
                contactId: contactId,
                endDate: { OR: [{ gte: new Date() }, { isNull: true }] },
              }
            : { contactId: contactId },
        });
      });
    },

    async getSponsorshipsForAnimal(
      animalId: string,
      onlyActive: boolean,
    ): Promise<Sponsorship[]> {
      return rlsDb.rls(async (tx) => {
        return tx.query.sponsorships.findMany({
          with: {
            animal: true,
            contact: true,
          },
          where: onlyActive
            ? {
                animalId: animalId,
                endDate: { OR: [{ gte: new Date() }, { isNull: true }] },
              }
            : { animalId: animalId },
        });
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
      const result = await rlsDb.rls(async (tx) => {
        const [sponsorship] = await tx
          .update(sponsorships)
          .set(data)
          .where(eq(sponsorships.id, id))
          .returning();
        return sponsorship;
      });
      const sponsorship = await this.getSponsorshipById(result.id);
      return sponsorship!;
    },

    async deleteSponsorship(id: string): Promise<void> {
      return rlsDb.rls(async (tx) => {
        await tx.delete(sponsorships).where(eq(sponsorships.id, id));
      });
    },
  };
}
