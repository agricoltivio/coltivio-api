import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { appDrizzle } from "../db/db";
import {
  wikiCategories,
  wikiCategoryTranslations,
  wikiEntries,
  wikiEntryImages,
  wikiEntryTags,
  wikiEntryTranslations,
  wikiTags,
} from "../db/schema";
import { createPresignedGetUrl, createPresignedPutUrl, deleteFile } from "../storage/storage";

const WIKI_BUCKET = "wiki-images";

export type WikiLocale = "de" | "en" | "it" | "fr";

export type WikiEntryTranslationInput = {
  locale: WikiLocale;
  title: string;
  body: string;
};

export type WikiEntryCreateInput = {
  id?: string;
  categoryId: string;
  translations: WikiEntryTranslationInput[];
  tagIds?: string[];
};

export type WikiEntryUpdateInput = {
  categoryId?: string;
  status?: "draft" | "published";
  translations?: WikiEntryTranslationInput[];
  tagIds?: string[];
};

export type WikiCategory = typeof wikiCategories.$inferSelect;
export type WikiCategoryTranslation = typeof wikiCategoryTranslations.$inferSelect;
export type WikiCategoryWithTranslations = WikiCategory & { translations: WikiCategoryTranslation[] };

export type WikiEntry = typeof wikiEntries.$inferSelect;
export type WikiEntryTranslation = typeof wikiEntryTranslations.$inferSelect;
export type WikiEntryImage = typeof wikiEntryImages.$inferSelect & { signedUrl: string };
export type WikiTag = typeof wikiTags.$inferSelect;

export type WikiEntryTagWithTag = { id: string; entryId: string; tagId: string; tag: WikiTag };

export type WikiEntryWithRelations = Omit<WikiEntry, ""> & {
  category: WikiCategoryWithTranslations;
  translations: WikiEntryTranslation[];
  images: WikiEntryImage[];
  tags: WikiEntryTagWithTag[];
};

const entryWith = {
  category: { with: { translations: true } },
  translations: true,
  images: true,
  tags: { with: { tag: true } },
} as const;

function attachImageUrls<T extends { images: (typeof wikiEntryImages.$inferSelect)[] }>(
  entry: T
): Omit<T, "images"> & { images: WikiEntryImage[] } {
  return {
    ...entry,
    images: entry.images.map((img) => ({ ...img, signedUrl: createPresignedGetUrl(WIKI_BUCKET, img.storagePath) })),
  };
}

export async function getWikiEntriesForFarm(farmId: string): Promise<WikiEntryWithRelations[]> {
  const entries = await appDrizzle.query.wikiEntries.findMany({
    where: { farmId },
    with: entryWith,
    orderBy: (e, { desc }) => [desc(e.updatedAt)],
  });
  return entries.map(attachImageUrls);
}

export async function getWikiEntryById(id: string): Promise<WikiEntryWithRelations | undefined> {
  const entry = await appDrizzle.query.wikiEntries.findFirst({ where: { id }, with: entryWith });
  if (!entry) return undefined;
  return attachImageUrls(entry);
}

export async function createWikiEntry(
  createdBy: string,
  farmId: string,
  input: WikiEntryCreateInput
): Promise<WikiEntryWithRelations> {
  return appDrizzle.transaction(async (tx) => {
    const entryId = input.id ?? uuidv4();

    await tx
      .insert(wikiEntries)
      .values({ id: entryId, status: "draft", createdBy, categoryId: input.categoryId, farmId });

    if (input.translations.length > 0) {
      await tx.insert(wikiEntryTranslations).values(
        input.translations.map((t) => ({
          entryId,
          locale: t.locale,
          title: t.title,
          body: t.body,
          updatedBy: createdBy,
        }))
      );
    }

    if (input.tagIds && input.tagIds.length > 0) {
      await tx.insert(wikiEntryTags).values(input.tagIds.map((tagId) => ({ entryId, tagId })));
    }

    const created = await tx.query.wikiEntries.findFirst({ where: { id: entryId }, with: entryWith });
    return attachImageUrls(created!);
  });
}

export async function updateWikiEntry(
  entryId: string,
  updatedBy: string,
  input: WikiEntryUpdateInput
): Promise<WikiEntryWithRelations> {
  return appDrizzle.transaction(async (tx) => {
    const updateFields: Partial<typeof wikiEntries.$inferInsert> = {};
    if (input.categoryId) updateFields.categoryId = input.categoryId;
    if (input.status) updateFields.status = input.status;
    if (Object.keys(updateFields).length > 0) {
      await tx
        .update(wikiEntries)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(wikiEntries.id, entryId));
    }

    if (input.translations) {
      for (const t of input.translations) {
        await tx
          .insert(wikiEntryTranslations)
          .values({ entryId, locale: t.locale, title: t.title, body: t.body, updatedBy, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: [wikiEntryTranslations.entryId, wikiEntryTranslations.locale],
            set: { title: t.title, body: t.body, updatedBy, updatedAt: new Date() },
          });
      }
    }

    if (input.tagIds !== undefined) {
      await tx.delete(wikiEntryTags).where(eq(wikiEntryTags.entryId, entryId));
      if (input.tagIds.length > 0) {
        await tx.insert(wikiEntryTags).values(input.tagIds.map((tagId) => ({ entryId, tagId })));
      }
    }

    const updated = await tx.query.wikiEntries.findFirst({ where: { id: entryId }, with: entryWith });
    return attachImageUrls(updated!);
  });
}

export async function deleteWikiEntry(entryId: string): Promise<void> {
  const images = await appDrizzle.query.wikiEntryImages.findMany({ where: { entryId } });
  await appDrizzle.delete(wikiEntryImages).where(eq(wikiEntryImages.entryId, entryId));
  await appDrizzle.delete(wikiEntries).where(eq(wikiEntries.id, entryId));
  for (const img of images) {
    await deleteFile(WIKI_BUCKET, img.storagePath).catch(() => null);
  }
}

export async function requestWikiImageUrl(
  entryId: string,
  farmId: string,
  filename: string
): Promise<{ signedUrl: string; path: string }> {
  const existingEntry = await appDrizzle.query.wikiEntries.findFirst({ where: { id: entryId } });
  if (existingEntry && existingEntry.farmId !== farmId) throw new Error("This entry does not belong to your farm");

  const ext = filename.split(".").pop() ?? "bin";
  const storagePath = `${entryId}/${uuidv4()}.${ext}`;
  const signedUrl = createPresignedPutUrl(WIKI_BUCKET, storagePath);
  return { signedUrl, path: storagePath };
}

export async function registerWikiImage(
  entryId: string,
  storagePath: string,
  uploadedBy: string,
  farmId: string
): Promise<{ id: string; signedUrl: string }> {
  if (!storagePath.startsWith(`${entryId}/`)) throw new Error("Invalid storage path for this entry");

  const existingEntry = await appDrizzle.query.wikiEntries.findFirst({ where: { id: entryId } });
  if (existingEntry && existingEntry.farmId !== farmId) throw new Error("This entry does not belong to your farm");

  const [image] = await appDrizzle.insert(wikiEntryImages).values({ entryId, storagePath, uploadedBy }).returning();
  return { id: image.id, signedUrl: createPresignedGetUrl(WIKI_BUCKET, image.storagePath) };
}

export async function deleteWikiImage(imageId: string): Promise<void> {
  const image = await appDrizzle.query.wikiEntryImages.findFirst({ where: { id: imageId } });
  if (!image) return;
  await appDrizzle.delete(wikiEntryImages).where(eq(wikiEntryImages.id, imageId));
  await deleteFile(WIKI_BUCKET, image.storagePath).catch(() => null);
}

export async function upsertWikiTag(name: string, slug: string, createdBy: string): Promise<WikiTag> {
  const existing = await appDrizzle.query.wikiTags.findFirst({ where: { slug } });
  if (existing) return existing;
  const [tag] = await appDrizzle.insert(wikiTags).values({ name, slug, createdBy }).returning();
  return tag;
}

export async function listWikiTags(): Promise<WikiTag[]> {
  return appDrizzle.query.wikiTags.findMany({});
}

export async function listWikiCategories(): Promise<WikiCategoryWithTranslations[]> {
  return appDrizzle.query.wikiCategories.findMany({
    with: { translations: true },
    orderBy: (cat, { asc }) => [asc(cat.createdAt)],
  });
}
