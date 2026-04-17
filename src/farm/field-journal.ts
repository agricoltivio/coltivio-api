import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import createHttpError from "http-errors";
import { RlsDb } from "../db/db";
import { fieldJournalEntries, fieldJournalImages } from "../db/schema";
import { fieldJournalStorage } from "../supabase/supabase";

const SIGNED_URL_EXPIRY_SECONDS = 3600;

export type FieldJournalImage = {
  id: string;
  journalEntryId: string;
  storagePath: string;
  createdAt: Date;
  signedUrl: string;
};

export type FieldJournalEntry = typeof fieldJournalEntries.$inferSelect;

export type FieldJournalEntryWithImages = FieldJournalEntry & {
  images: FieldJournalImage[];
};

export type FieldJournalEntryCreateInput = {
  title: string;
  date: Date;
  content?: string;
};

export type FieldJournalEntryUpdateInput = {
  title?: string;
  date?: Date;
  content?: string;
};

async function attachSignedUrls(images: (typeof fieldJournalImages.$inferSelect)[]): Promise<FieldJournalImage[]> {
  return Promise.all(
    images.map(async (image) => {
      const { data, error } = await fieldJournalStorage.createSignedUrl(image.storagePath, SIGNED_URL_EXPIRY_SECONDS);
      if (error || !data) {
        throw new Error(`Failed to create signed URL: ${error?.message}`);
      }
      return { ...image, signedUrl: data.signedUrl };
    })
  );
}

export function fieldJournalApi(db: RlsDb) {
  async function listEntries(farmId: string): Promise<FieldJournalEntryWithImages[]> {
    const entries = await db.rls(async (tx) => {
      return tx.query.fieldJournalEntries.findMany({
        where: { farmId },
        with: { images: true },
        orderBy: (t, { desc }) => [desc(t.date), desc(t.createdAt)],
      });
    });
    return Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        images: await attachSignedUrls(entry.images),
      }))
    );
  }

  async function getEntry(entryId: string): Promise<FieldJournalEntryWithImages> {
    const entry = await db.rls(async (tx) => {
      return tx.query.fieldJournalEntries.findFirst({
        where: { id: entryId },
        with: { images: true },
      });
    });
    if (!entry) throw createHttpError(404, "Journal entry not found");
    return { ...entry, images: await attachSignedUrls(entry.images) };
  }

  async function createEntry(
    farmId: string,
    createdBy: string,
    input: FieldJournalEntryCreateInput
  ): Promise<FieldJournalEntry> {
    return db.rls(async (tx) => {
      const [entry] = await tx
        .insert(fieldJournalEntries)
        .values({ farmId, createdBy, ...input })
        .returning();
      return entry;
    });
  }

  async function updateEntry(entryId: string, input: FieldJournalEntryUpdateInput): Promise<FieldJournalEntry> {
    return db.rls(async (tx) => {
      const [updated] = await tx
        .update(fieldJournalEntries)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(fieldJournalEntries.id, entryId))
        .returning();
      if (!updated) throw createHttpError(404, "Journal entry not found");
      return updated;
    });
  }

  async function deleteEntry(entryId: string): Promise<void> {
    return db.rls(async (tx) => {
      const entry = await tx.query.fieldJournalEntries.findFirst({
        where: { id: entryId },
        with: { images: true },
      });
      if (!entry) return;

      // Delete images first (while RLS can still resolve them via the entry join)
      if (entry.images.length > 0) {
        await tx.delete(fieldJournalImages).where(eq(fieldJournalImages.journalEntryId, entryId));
      }

      await tx.delete(fieldJournalEntries).where(eq(fieldJournalEntries.id, entryId));

      // Best-effort storage cleanup
      if (entry.images.length > 0) {
        await fieldJournalStorage.remove(entry.images.map((img) => img.storagePath));
      }
    });
  }

  async function requestSignedImageUrl(
    journalEntryId: string,
    filename: string
  ): Promise<{ signedUrl: string; path: string }> {
    const ext = filename.split(".").pop() ?? "bin";
    const path = `${journalEntryId}/${uuidv4()}.${ext}`;

    const { data, error } = await fieldJournalStorage.createSignedUploadUrl(path);
    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message}`);
    }
    return { signedUrl: data.signedUrl, path };
  }

  async function registerImage(journalEntryId: string, storagePath: string): Promise<FieldJournalImage> {
    if (!storagePath.startsWith(`${journalEntryId}/`)) {
      throw createHttpError(400, "Invalid storage path for this journal entry");
    }

    const [image] = await db.admin.insert(fieldJournalImages).values({ journalEntryId, storagePath }).returning();

    const { data, error } = await fieldJournalStorage.createSignedUrl(image.storagePath, SIGNED_URL_EXPIRY_SECONDS);
    if (error || !data) {
      throw new Error(`Failed to create signed URL: ${error?.message}`);
    }
    return { ...image, signedUrl: data.signedUrl };
  }

  async function deleteImage(imageId: string): Promise<void> {
    return db.rls(async (tx) => {
      const image = await tx.query.fieldJournalImages.findFirst({ where: { id: imageId } });
      if (!image) return;

      await tx.delete(fieldJournalImages).where(eq(fieldJournalImages.id, imageId));

      // Best-effort storage removal
      await fieldJournalStorage.remove([image.storagePath]);
    });
  }

  return {
    listEntries,
    getEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    requestSignedImageUrl,
    registerImage,
    deleteImage,
  };
}
