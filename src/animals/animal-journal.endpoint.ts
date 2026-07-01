import { ez } from "express-zod-api";
import { z } from "zod";
import { permissionFarmEndpoint } from "../endpoint-factory";
import {
  listAnimalJournalEntries,
  getAnimalJournalEntry,
  createAnimalJournalEntry,
  updateAnimalJournalEntry,
  deleteAnimalJournalEntry,
  requestAnimalJournalSignedImageUrl,
  registerAnimalJournalImage,
  deleteAnimalJournalImage,
} from "./animal-journal";

const animalsRead = permissionFarmEndpoint("animals", "read");
const animalsWrite = permissionFarmEndpoint("animals", "write");

const journalImageSchema = z.object({
  id: z.string(),
  journalEntryId: z.string(),
  storagePath: z.string(),
  createdAt: ez.dateOut(),
  signedUrl: z.string(),
});

const journalEntrySchema = z.object({
  id: z.string(),
  animalId: z.string(),
  farmId: z.string(),
  title: z.string(),
  date: ez.dateOut(),
  content: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: ez.dateOut(),
  updatedAt: ez.dateOut(),
});

const journalEntryWithImagesSchema = journalEntrySchema.extend({
  images: z.array(journalImageSchema),
});

export const listAnimalJournalEntriesEndpoint = animalsRead.build({
  method: "get",
  input: z.object({ animalId: z.string() }),
  output: z.object({ entries: z.array(journalEntryWithImagesSchema) }),
  handler: async ({ input, ctx: { farmId } }) => {
    const entries = await listAnimalJournalEntries(input.animalId, farmId);
    return { entries };
  },
});

export const createAnimalJournalEntryEndpoint = animalsWrite.build({
  method: "post",
  input: z.object({
    animalId: z.string(),
    title: z.string().min(1),
    date: ez.dateIn(),
    content: z.string().optional(),
  }),
  output: journalEntrySchema,
  handler: async ({ input, ctx: { farmId, user } }) => {
    const { animalId, ...entryInput } = input;
    return createAnimalJournalEntry(animalId, farmId, user.id, entryInput);
  },
});

export const getAnimalJournalEntryEndpoint = animalsRead.build({
  method: "get",
  input: z.object({ entryId: z.string() }),
  output: journalEntryWithImagesSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return getAnimalJournalEntry(input.entryId, farmId);
  },
});

export const updateAnimalJournalEntryEndpoint = animalsWrite.build({
  method: "patch",
  input: z.object({
    entryId: z.string(),
    title: z.string().min(1).optional(),
    date: ez.dateIn().optional(),
    content: z.string().optional(),
  }),
  output: journalEntrySchema,
  handler: async ({ input, ctx: { farmId } }) => {
    const { entryId, ...updateInput } = input;
    return updateAnimalJournalEntry(entryId, farmId, updateInput);
  },
});

export const deleteAnimalJournalEntryEndpoint = animalsWrite.build({
  method: "delete",
  input: z.object({ entryId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx: { farmId } }) => {
    await deleteAnimalJournalEntry(input.entryId, farmId);
    return {};
  },
});

export const requestAnimalJournalImageSignedUrlEndpoint = animalsWrite.build({
  method: "post",
  input: z.object({
    journalEntryId: z.string(),
    filename: z.string().min(1),
  }),
  output: z.object({
    signedUrl: z.string(),
    path: z.string(),
  }),
  handler: async ({ input }) => {
    return requestAnimalJournalSignedImageUrl(input.journalEntryId, input.filename);
  },
});

export const registerAnimalJournalImageEndpoint = animalsWrite.build({
  method: "post",
  input: z.object({
    journalEntryId: z.string(),
    storagePath: z.string().min(1),
  }),
  output: journalImageSchema,
  handler: async ({ input }) => {
    return registerAnimalJournalImage(input.journalEntryId, input.storagePath);
  },
});

export const deleteAnimalJournalImageEndpoint = animalsWrite.build({
  method: "delete",
  input: z.object({ imageId: z.string() }),
  output: z.object({}),
  handler: async ({ input }) => {
    await deleteAnimalJournalImage(input.imageId);
    return {};
  },
});
