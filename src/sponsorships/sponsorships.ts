import { eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { sponsorships, payments } from "../db/schema";
import { Animal } from "../animals/animals";
import { Contact } from "../contacts/contacts";
import { Payment } from "../payments/payments";
import { SponsorshipPrograms } from "./sponsorship-programs";

export type SponsorshipCreateInput = Omit<typeof sponsorships.$inferInsert, "id" | "farmId">;
export type SponsorshipUpdateInput = Partial<SponsorshipCreateInput>;
export type Sponsorship = typeof sponsorships.$inferSelect;

export type SponsorshipWithRelations = Sponsorship & {
  sponsorshipProgram: SponsorshipPrograms;
  animal: Animal;
  contact: Contact;
  payments: Payment[];
};

export async function createSponsorship(
  sponsorshipInput: SponsorshipCreateInput,
  farmId: string
): Promise<Sponsorship> {
  const [sponsorship] = await appDrizzle
    .insert(sponsorships)
    .values({ farmId, ...sponsorshipInput })
    .returning();
  return sponsorship;
}

export async function getSponsorshipById(id: string): Promise<SponsorshipWithRelations | undefined> {
  return appDrizzle.query.sponsorships.findFirst({
    where: { id },
    with: {
      sponsorshipProgram: true,
      animal: { with: { earTag: true } },
      contact: true,
      payments: true,
    },
  });
}

export async function getSponsorshipsForFarm(farmId: string, onlyActive: boolean): Promise<SponsorshipWithRelations[]> {
  return appDrizzle.query.sponsorships.findMany({
    with: {
      sponsorshipProgram: true,
      animal: { with: { earTag: true } },
      contact: true,
      payments: true,
    },
    where: onlyActive ? { farmId, endDate: { OR: [{ gte: new Date() }, { isNull: true }] } } : { farmId },
  });
}

export async function getSponsorshipsForContact(
  contactId: string,
  onlyActive: boolean
): Promise<Array<Omit<SponsorshipWithRelations, "contact">>> {
  return appDrizzle.query.sponsorships.findMany({
    with: {
      sponsorshipProgram: true,
      animal: { with: { earTag: true } },
      payments: true,
    },
    where: onlyActive ? { contactId, endDate: { OR: [{ gte: new Date() }, { isNull: true }] } } : { contactId },
  });
}

export async function getSponsorshipsForAnimal(
  animalId: string,
  onlyActive: boolean
): Promise<Array<Omit<SponsorshipWithRelations, "animal">>> {
  return appDrizzle.query.sponsorships.findMany({
    with: {
      sponsorshipProgram: true,
      contact: true,
      payments: true,
    },
    where: onlyActive ? { animalId, endDate: { OR: [{ gte: new Date() }, { isNull: true }] } } : { animalId },
  });
}

export async function getPaymentsForSponsorship(sponsorshipId: string): Promise<Payment[]> {
  return appDrizzle.select().from(payments).where(eq(payments.sponsorshipId, sponsorshipId));
}

export async function updateSponsorship(id: string, data: SponsorshipUpdateInput): Promise<Sponsorship> {
  const [sponsorship] = await appDrizzle.update(sponsorships).set(data).where(eq(sponsorships.id, id)).returning();
  return sponsorship;
}

export async function deleteSponsorship(id: string): Promise<void> {
  await appDrizzle.delete(sponsorships).where(eq(sponsorships.id, id));
}
