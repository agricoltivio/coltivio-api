import { eq } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { sponsorshipPrograms } from "../db/schema";

export type SponsorshipProgramCreateInput = Omit<typeof sponsorshipPrograms.$inferInsert, "id" | "farmId">;
export type SponsorshipProgramUpdateInput = Partial<SponsorshipProgramCreateInput>;
export type SponsorshipPrograms = typeof sponsorshipPrograms.$inferSelect;

export async function createSponsorshipProgram(
  input: SponsorshipProgramCreateInput,
  farmId: string
): Promise<SponsorshipPrograms> {
  const [sponsorshipProgram] = await appDrizzle
    .insert(sponsorshipPrograms)
    .values({ farmId, ...input })
    .returning();
  return sponsorshipProgram;
}

export async function getSponsorshipProgramById(id: string): Promise<SponsorshipPrograms | undefined> {
  const [sponsorshipProgram] = await appDrizzle
    .select()
    .from(sponsorshipPrograms)
    .where(eq(sponsorshipPrograms.id, id));
  return sponsorshipProgram;
}

export async function getSponsorshipProgramsForFarm(farmId: string): Promise<SponsorshipPrograms[]> {
  return appDrizzle.select().from(sponsorshipPrograms).where(eq(sponsorshipPrograms.farmId, farmId));
}

export async function updateSponsorshipProgram(
  id: string,
  data: SponsorshipProgramUpdateInput
): Promise<SponsorshipPrograms> {
  const [sponsorshipProgram] = await appDrizzle
    .update(sponsorshipPrograms)
    .set(data)
    .where(eq(sponsorshipPrograms.id, id))
    .returning();
  return sponsorshipProgram;
}

export async function deleteSponsorshipProgram(id: string): Promise<void> {
  await appDrizzle.delete(sponsorshipPrograms).where(eq(sponsorshipPrograms.id, id));
}
