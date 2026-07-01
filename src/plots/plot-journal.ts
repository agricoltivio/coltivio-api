import { eq } from "drizzle-orm";
import createHttpError from "http-errors";
import { v4 as uuidv4 } from "uuid";
import { appDrizzle } from "../db/db";
import { plotJournalEntries, plotJournalImages } from "../db/schema";
import { createPresignedGetUrl, createPresignedPutUrl, deleteFile } from "../storage/storage";

const BUCKET = "plot-journal-images";

export type PlotJournalImage = {
  id: string;
  journalEntryId: string;
  storagePath: string;
  createdAt: Date;
  signedUrl: string;
};

export type PlotJournalEntry = typeof plotJournalEntries.$inferSelect;

export type PlotJournalEntryWithImages = PlotJournalEntry & {
  images: PlotJournalImage[];
};

export type PlotJournalEntryCreateInput = {
  title: string;
  date: Date;
  content?: string;
};

export type PlotJournalEntryUpdateInput = {
  title?: string;
  date?: Date;
  content?: string;
};

function attachSignedUrls(images: (typeof plotJournalImages.$inferSelect)[]): PlotJournalImage[] {
  return images.map((image) => ({
    ...image,
    signedUrl: createPresignedGetUrl(BUCKET, image.storagePath),
  }));
}

export async function listPlotJournalEntries(plotId: string, farmId: string): Promise<PlotJournalEntryWithImages[]> {
  const entries = await appDrizzle.query.plotJournalEntries.findMany({
    where: { plotId, farmId },
    with: { images: true },
    orderBy: (t, { desc }) => [desc(t.date), desc(t.createdAt)],
  });
  return entries.map((entry) => ({ ...entry, images: attachSignedUrls(entry.images) }));
}

export async function getPlotJournalEntry(entryId: string, farmId: string): Promise<PlotJournalEntryWithImages> {
  const entry = await appDrizzle.query.plotJournalEntries.findFirst({
    where: { id: entryId, farmId },
    with: { images: true },
  });
  if (!entry) throw createHttpError(404, "Journal entry not found");
  return { ...entry, images: attachSignedUrls(entry.images) };
}

export async function createPlotJournalEntry(
  plotId: string,
  farmId: string,
  createdBy: string,
  input: PlotJournalEntryCreateInput
): Promise<PlotJournalEntry> {
  const plot = await appDrizzle.query.plots.findFirst({ where: { id: plotId, farmId } });
  if (!plot) throw createHttpError(404, "Plot not found");

  const [entry] = await appDrizzle
    .insert(plotJournalEntries)
    .values({ plotId, farmId, createdBy, ...input })
    .returning();
  return entry;
}

export async function updatePlotJournalEntry(
  entryId: string,
  farmId: string,
  input: PlotJournalEntryUpdateInput
): Promise<PlotJournalEntry> {
  const [updated] = await appDrizzle
    .update(plotJournalEntries)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(plotJournalEntries.id, entryId) && eq(plotJournalEntries.farmId, farmId))
    .returning();
  if (!updated) throw createHttpError(404, "Journal entry not found");
  return updated;
}

export async function deletePlotJournalEntry(entryId: string, farmId: string): Promise<void> {
  const entry = await appDrizzle.query.plotJournalEntries.findFirst({
    where: { id: entryId, farmId },
    with: { images: true },
  });
  if (!entry) return;

  if (entry.images.length > 0) {
    await appDrizzle.delete(plotJournalImages).where(eq(plotJournalImages.journalEntryId, entryId));
  }
  await appDrizzle.delete(plotJournalEntries).where(eq(plotJournalEntries.id, entryId));

  // Best-effort storage cleanup
  for (const img of entry.images) {
    await deleteFile(BUCKET, img.storagePath).catch(() => null);
  }
}

export async function requestPlotJournalSignedImageUrl(
  journalEntryId: string,
  filename: string
): Promise<{ signedUrl: string; path: string }> {
  const ext = filename.split(".").pop() ?? "bin";
  const storagePath = `${journalEntryId}/${uuidv4()}.${ext}`;
  const signedUrl = createPresignedPutUrl(BUCKET, storagePath);
  return { signedUrl, path: storagePath };
}

export async function registerPlotJournalImage(journalEntryId: string, storagePath: string): Promise<PlotJournalImage> {
  if (!storagePath.startsWith(`${journalEntryId}/`)) {
    throw createHttpError(400, "Invalid storage path for this journal entry");
  }

  const [image] = await appDrizzle.insert(plotJournalImages).values({ journalEntryId, storagePath }).returning();
  return { ...image, signedUrl: createPresignedGetUrl(BUCKET, image.storagePath) };
}

export async function deletePlotJournalImage(imageId: string): Promise<void> {
  const image = await appDrizzle.query.plotJournalImages.findFirst({ where: { id: imageId } });
  if (!image) return;

  await appDrizzle.delete(plotJournalImages).where(eq(plotJournalImages.id, imageId));
  await deleteFile(BUCKET, image.storagePath).catch(() => null);
}
