import { eq } from "drizzle-orm";
import createHttpError from "http-errors";
import { v4 as uuidv4 } from "uuid";
import { appDrizzle } from "../db/db";
import { animalJournalEntries, animalJournalImages } from "../db/schema";
import { createPresignedGetUrl, createPresignedPutUrl, deleteFile } from "../storage/storage";

const BUCKET = "animal-journal-images";

export type AnimalJournalImage = {
  id: string;
  journalEntryId: string;
  storagePath: string;
  createdAt: Date;
  signedUrl: string;
};

export type AnimalJournalEntry = typeof animalJournalEntries.$inferSelect;

export type AnimalJournalEntryWithImages = AnimalJournalEntry & {
  images: AnimalJournalImage[];
};

export type AnimalJournalEntryCreateInput = {
  title: string;
  date: Date;
  content?: string;
};

export type AnimalJournalEntryUpdateInput = {
  title?: string;
  date?: Date;
  content?: string;
};

function attachSignedUrls(images: (typeof animalJournalImages.$inferSelect)[]): AnimalJournalImage[] {
  return images.map((image) => ({ ...image, signedUrl: createPresignedGetUrl(BUCKET, image.storagePath) }));
}

export async function listAnimalJournalEntries(
  animalId: string,
  farmId: string
): Promise<AnimalJournalEntryWithImages[]> {
  const entries = await appDrizzle.query.animalJournalEntries.findMany({
    where: { animalId, farmId },
    with: { images: true },
    orderBy: (t, { desc }) => [desc(t.date), desc(t.createdAt)],
  });
  return entries.map((entry) => ({ ...entry, images: attachSignedUrls(entry.images) }));
}

export async function getAnimalJournalEntry(entryId: string, farmId: string): Promise<AnimalJournalEntryWithImages> {
  const entry = await appDrizzle.query.animalJournalEntries.findFirst({
    where: { id: entryId, farmId },
    with: { images: true },
  });
  if (!entry) throw createHttpError(404, "Journal entry not found");
  return { ...entry, images: attachSignedUrls(entry.images) };
}

export async function createAnimalJournalEntry(
  animalId: string,
  farmId: string,
  createdBy: string,
  input: AnimalJournalEntryCreateInput
): Promise<AnimalJournalEntry> {
  const animal = await appDrizzle.query.animals.findFirst({ where: { id: animalId, farmId } });
  if (!animal) throw createHttpError(404, "Animal not found");

  const [entry] = await appDrizzle
    .insert(animalJournalEntries)
    .values({ animalId, farmId, createdBy, ...input })
    .returning();
  return entry;
}

export async function updateAnimalJournalEntry(
  entryId: string,
  farmId: string,
  input: AnimalJournalEntryUpdateInput
): Promise<AnimalJournalEntry> {
  const [updated] = await appDrizzle
    .update(animalJournalEntries)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(animalJournalEntries.id, entryId) && eq(animalJournalEntries.farmId, farmId))
    .returning();
  if (!updated) throw createHttpError(404, "Journal entry not found");
  return updated;
}

export async function deleteAnimalJournalEntry(entryId: string, farmId: string): Promise<void> {
  const entry = await appDrizzle.query.animalJournalEntries.findFirst({
    where: { id: entryId, farmId },
    with: { images: true },
  });
  if (!entry) return;

  if (entry.images.length > 0) {
    await appDrizzle.delete(animalJournalImages).where(eq(animalJournalImages.journalEntryId, entryId));
  }
  await appDrizzle.delete(animalJournalEntries).where(eq(animalJournalEntries.id, entryId));

  for (const img of entry.images) {
    await deleteFile(BUCKET, img.storagePath).catch(() => null);
  }
}

export async function requestAnimalJournalSignedImageUrl(
  journalEntryId: string,
  filename: string
): Promise<{ signedUrl: string; path: string }> {
  const ext = filename.split(".").pop() ?? "bin";
  const storagePath = `${journalEntryId}/${uuidv4()}.${ext}`;
  const signedUrl = createPresignedPutUrl(BUCKET, storagePath);
  return { signedUrl, path: storagePath };
}

export async function registerAnimalJournalImage(
  journalEntryId: string,
  storagePath: string
): Promise<AnimalJournalImage> {
  if (!storagePath.startsWith(`${journalEntryId}/`)) {
    throw createHttpError(400, "Invalid storage path for this journal entry");
  }

  const [image] = await appDrizzle.insert(animalJournalImages).values({ journalEntryId, storagePath }).returning();
  return { ...image, signedUrl: createPresignedGetUrl(BUCKET, image.storagePath) };
}

export async function deleteAnimalJournalImage(imageId: string): Promise<void> {
  const image = await appDrizzle.query.animalJournalImages.findFirst({ where: { id: imageId } });
  if (!image) return;

  await appDrizzle.delete(animalJournalImages).where(eq(animalJournalImages.id, imageId));
  await deleteFile(BUCKET, image.storagePath).catch(() => null);
}
