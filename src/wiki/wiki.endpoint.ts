import createHttpError from "http-errors";
import { z } from "zod";
import { wikiEntryStatusSchema, wikiLocaleSchema, wikiCategorySchema } from "../db/schema";
import { authenticatedEndpointFactory, farmEndpointFactory } from "../endpoint-factory";
import {
  getWikiEntriesForFarm,
  getWikiEntryById,
  createWikiEntry,
  updateWikiEntry,
  deleteWikiEntry,
  requestWikiImageUrl,
  registerWikiImage,
  deleteWikiImage,
  upsertWikiTag,
  listWikiTags,
  listWikiCategories,
} from "./wiki";

// ─── Shared output schemas ───────────────────────────────────────────────────

export const wikiTranslationSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  locale: wikiLocaleSchema,
  title: z.string(),
  body: z.string(),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().or(z.date()),
});

export const wikiTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.string().or(z.date()),
});

export const wikiEntryTagSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  tagId: z.string(),
  tag: wikiTagSchema,
});

export const wikiImageSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  storagePath: z.string(),
  signedUrl: z.string(),
  altText: z.string().nullable(),
  uploadedBy: z.string().nullable(),
  createdAt: z.string().or(z.date()),
});

export const wikiEntrySchema = z.object({
  id: z.string(),
  status: wikiEntryStatusSchema,
  createdBy: z.string(),
  farmId: z.string(),
  categoryId: z.string(),
  category: wikiCategorySchema,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  translations: z.array(wikiTranslationSchema),
  images: z.array(wikiImageSchema),
  tags: z.array(wikiEntryTagSchema),
});

// ─── Input schemas ───────────────────────────────────────────────────────────

const translationInputSchema = z.object({
  locale: wikiLocaleSchema,
  title: z.string(),
  body: z.string(),
});

const createEntryInputSchema = z.object({
  id: z.string().optional(), // Pre-generated UUID for image upload flow
  categoryId: z.string().uuid(),
  translations: z.array(translationInputSchema).min(1),
  tagIds: z.array(z.string()).optional(),
});

const updateEntryInputSchema = z.object({
  categoryId: z.string().uuid().optional(),
  translations: z.array(translationInputSchema).optional(),
  tagIds: z.array(z.string()).optional(),
});

// ─── Get farm entries ─────────────────────────────────────────────────────────

export const getMyWikiEntriesEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(wikiEntrySchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getWikiEntriesForFarm(farmId);
    return { result, count: result.length };
  },
});

// ─── Get entry by ID ──────────────────────────────────────────────────────────

export const getWikiEntryByIdEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({ entryId: z.string() }),
  output: wikiEntrySchema,
  handler: async ({ input }) => {
    const entry = await getWikiEntryById(input.entryId);
    if (!entry) throw createHttpError(404, "Wiki entry not found");
    return entry;
  },
});

// ─── Create wiki entry ───────────────────────────────────────────────────────

export const createWikiEntryEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createEntryInputSchema,
  output: wikiEntrySchema,
  handler: async ({ input, ctx: { user, farmId } }) => {
    return createWikiEntry(user.id, farmId, {
      ...input,
      translations: input.translations.filter((t) => t.title.trim().length > 0),
    });
  },
});

// ─── Update wiki entry ───────────────────────────────────────────────────────

export const updateWikiEntryEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateEntryInputSchema.extend({ entryId: z.string() }),
  output: wikiEntrySchema,
  handler: async ({ input, ctx: { user } }) => {
    const { entryId, ...data } = input;
    const entry = await getWikiEntryById(entryId);
    if (!entry) throw createHttpError(404, "Wiki entry not found");
    return updateWikiEntry(entryId, user.id, {
      ...data,
      translations: data.translations?.filter((t) => t.title.trim().length > 0),
    });
  },
});

// ─── Delete wiki entry ───────────────────────────────────────────────────────

export const deleteWikiEntryEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ entryId: z.string() }),
  output: z.object({}),
  handler: async ({ input }) => {
    const entry = await getWikiEntryById(input.entryId);
    if (!entry) throw createHttpError(404, "Wiki entry not found");
    await deleteWikiEntry(input.entryId);
    return {};
  },
});

// ─── Image: request signed upload URL ────────────────────────────────────────

export const requestWikiImageSignedUrlEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    entryId: z.string(),
    filename: z.string().min(1),
  }),
  output: z.object({
    signedUrl: z.string(),
    path: z.string(),
  }),
  handler: async ({ input, ctx: { farmId } }) => {
    return requestWikiImageUrl(input.entryId, farmId, input.filename);
  },
});

// ─── Image: register after direct upload ─────────────────────────────────────

export const registerWikiImageEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    entryId: z.string(),
    storagePath: z.string().min(1),
  }),
  output: z.object({
    id: z.string(),
    signedUrl: z.string(),
  }),
  handler: async ({ input, ctx: { user, farmId } }) => {
    return registerWikiImage(input.entryId, input.storagePath, user.id, farmId);
  },
});

// ─── Image: delete ────────────────────────────────────────────────────────────

export const deleteWikiImageEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ imageId: z.string() }),
  output: z.object({}),
  handler: async ({ input }) => {
    await deleteWikiImage(input.imageId);
    return {};
  },
});

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const listWikiTagsEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(wikiTagSchema),
    count: z.number(),
  }),
  handler: async () => {
    const result = await listWikiTags();
    return { result, count: result.length };
  },
});

export const upsertWikiTagEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: z.object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/),
  }),
  output: wikiTagSchema,
  handler: async ({ input, ctx: { user } }) => {
    return upsertWikiTag(input.name, input.slug, user.id);
  },
});

// ─── Categories ───────────────────────────────────────────────────────────────

export const listWikiCategoriesEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(wikiCategorySchema),
    count: z.number(),
  }),
  handler: async () => {
    const result = await listWikiCategories();
    return { result, count: result.length };
  },
});
