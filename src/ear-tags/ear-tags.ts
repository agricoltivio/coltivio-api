import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { appDrizzle } from "../db/db";
import { animals, earTags } from "../db/schema";
import { Animal } from "../animals/animals";

export type EarTag = typeof earTags.$inferSelect;
export type EarTagWithAssignment = EarTag & { animal: Animal | null };

export async function getEarTagsForFarm(farmId: string): Promise<EarTagWithAssignment[]> {
  return appDrizzle.query.earTags.findMany({
    where: { farmId },
    with: {
      animal: {
        with: { earTag: true },
      },
    },
  });
}

export async function getAvailableEarTagsForFarm(farmId: string): Promise<EarTag[]> {
  const assignedTagIds = appDrizzle
    .select({ earTagId: animals.earTagId })
    .from(animals)
    .where(and(eq(animals.farmId, farmId), isNotNull(animals.earTagId)));

  return appDrizzle
    .select()
    .from(earTags)
    .where(and(eq(earTags.farmId, farmId), notInArray(earTags.id, assignedTagIds)));
}

export async function createEarTagRange(fromNumber: string, toNumber: string, farmId: string): Promise<EarTag[]> {
  const fromMatch = fromNumber.match(/^([A-Za-z]*)(\d+)$/);
  const toMatch = toNumber.match(/^([A-Za-z]*)(\d+)$/);

  if (!fromMatch || !toMatch) {
    throw new Error("Invalid ear tag format. Expected format: PREFIX + NUMBER (e.g., CH001)");
  }

  const [, fromPrefix, fromNumStr] = fromMatch;
  const [, toPrefix, toNumStr] = toMatch;

  if (fromPrefix !== toPrefix) {
    throw new Error("Prefix must be the same for both range boundaries");
  }

  const fromNum = parseInt(fromNumStr, 10);
  const toNum = parseInt(toNumStr, 10);

  if (fromNum > toNum) {
    throw new Error("Start number must be less than or equal to end number");
  }

  const padding = fromNumStr.length;
  const tagsToCreate: { number: string }[] = [];
  for (let i = fromNum; i <= toNum; i++) {
    tagsToCreate.push({ number: `${fromPrefix}${i.toString().padStart(padding, "0")}` });
  }

  return appDrizzle
    .insert(earTags)
    .values(tagsToCreate.map((tag) => ({ farmId, ...tag })))
    .returning();
}

export async function deleteEarTagRange(
  farmId: string,
  fromNumber: string,
  toNumber: string
): Promise<{ deletedCount: number; skippedAssigned: string[] }> {
  const fromMatch = fromNumber.match(/^([A-Za-z]*)(\d+)$/);
  const toMatch = toNumber.match(/^([A-Za-z]*)(\d+)$/);

  if (!fromMatch || !toMatch) {
    throw new Error("Invalid ear tag format. Expected format: PREFIX + NUMBER (e.g., CH001)");
  }

  const [, fromPrefix, fromNumStr] = fromMatch;
  const [, toPrefix, toNumStr] = toMatch;

  if (fromPrefix !== toPrefix) throw new Error("Prefix must be the same for both range boundaries");

  const fromNum = parseInt(fromNumStr, 10);
  const toNum = parseInt(toNumStr, 10);
  if (fromNum > toNum) throw new Error("Start number must be less than or equal to end number");

  const padding = fromNumStr.length;
  const numbersInRange: string[] = [];
  for (let i = fromNum; i <= toNum; i++) {
    numbersInRange.push(`${fromPrefix}${i.toString().padStart(padding, "0")}`);
  }

  const tagsInRange = await appDrizzle
    .select({ id: earTags.id, number: earTags.number, animalId: animals.id })
    .from(earTags)
    .leftJoin(animals, eq(animals.earTagId, earTags.id))
    .where(and(eq(earTags.farmId, farmId), inArray(earTags.number, numbersInRange)));

  const assignedNumbers: string[] = [];
  const unassignedTagIds: string[] = [];

  for (const tag of tagsInRange) {
    if (tag.animalId) {
      assignedNumbers.push(tag.number);
    } else {
      unassignedTagIds.push(tag.id);
    }
  }

  if (unassignedTagIds.length > 0) {
    await appDrizzle.delete(earTags).where(inArray(earTags.id, unassignedTagIds));
  }

  return { deletedCount: unassignedTagIds.length, skippedAssigned: assignedNumbers };
}

export async function getEarTagById(id: string): Promise<EarTagWithAssignment | undefined> {
  return appDrizzle.query.earTags.findFirst({
    where: { id },
    with: {
      animal: { with: { earTag: true } },
    },
  });
}

export async function createEarTags(numbers: string[], farmId: string): Promise<EarTag[]> {
  if (numbers.length === 0) return [];
  return appDrizzle
    .insert(earTags)
    .values(numbers.map((number) => ({ farmId, number })))
    .returning();
}
