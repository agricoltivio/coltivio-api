import { ez } from "express-zod-api";
import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";

const journalImageSchema = z.object({
  id: z.string(),
  journalEntryId: z.string(),
  storagePath: z.string(),
  createdAt: ez.dateOut(),
  signedUrl: z.string(),
});

const journalEntrySchema = z.object({
  id: z.string(),
  plotId: z.string(),
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

export const listPlotJournalEntriesEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: z.object({ entries: z.array(journalEntryWithImagesSchema) }),
  handler: async ({ input, ctx: { plotJournal, farmId } }) => {
    const entries = await plotJournal.listEntries(input.plotId, farmId);
    return { entries };
  },
});

export const createPlotJournalEntryEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    plotId: z.string(),
    title: z.string().min(1),
    date: ez.dateIn(),
    content: z.string().optional(),
  }),
  output: journalEntrySchema,
  handler: async ({ input, ctx: { plotJournal, farmId, user } }) => {
    const { plotId, ...entryInput } = input;
    return plotJournal.createEntry(plotId, farmId, user.id, entryInput);
  },
});

export const getPlotJournalEntryEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ entryId: z.string() }),
  output: journalEntryWithImagesSchema,
  handler: async ({ input, ctx: { plotJournal } }) => {
    return plotJournal.getEntry(input.entryId);
  },
});

export const updatePlotJournalEntryEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: z.object({
    entryId: z.string(),
    title: z.string().min(1).optional(),
    date: ez.dateIn().optional(),
    content: z.string().optional(),
  }),
  output: journalEntrySchema,
  handler: async ({ input, ctx: { plotJournal } }) => {
    const { entryId, ...updateInput } = input;
    return plotJournal.updateEntry(entryId, updateInput);
  },
});

export const deletePlotJournalEntryEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ entryId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx: { plotJournal } }) => {
    await plotJournal.deleteEntry(input.entryId);
    return {};
  },
});

export const requestPlotJournalImageSignedUrlEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    journalEntryId: z.string(),
    filename: z.string().min(1),
  }),
  output: z.object({
    signedUrl: z.string(),
    path: z.string(),
  }),
  handler: async ({ input, ctx: { plotJournal } }) => {
    return plotJournal.requestSignedImageUrl(input.journalEntryId, input.filename);
  },
});

export const registerPlotJournalImageEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    journalEntryId: z.string(),
    storagePath: z.string().min(1),
  }),
  output: journalImageSchema,
  handler: async ({ input, ctx: { plotJournal } }) => {
    return plotJournal.registerImage(input.journalEntryId, input.storagePath);
  },
});

export const deletePlotJournalImageEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ imageId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx: { plotJournal } }) => {
    await plotJournal.deleteImage(input.imageId);
    return {};
  },
});
