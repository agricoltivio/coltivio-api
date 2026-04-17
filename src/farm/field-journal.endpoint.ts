import { ez } from "express-zod-api";
import { z } from "zod";
import { permissionMembershipEndpoint } from "../endpoint-factory";

const fieldCalendarRead = permissionMembershipEndpoint("field_calendar", "read");
const fieldCalendarWrite = permissionMembershipEndpoint("field_calendar", "write");

const journalImageSchema = z.object({
  id: z.string(),
  journalEntryId: z.string(),
  storagePath: z.string(),
  createdAt: ez.dateOut(),
  signedUrl: z.string(),
});

const journalEntrySchema = z.object({
  id: z.string(),
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

export const listFieldJournalEntriesEndpoint = fieldCalendarRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({ entries: z.array(journalEntryWithImagesSchema) }),
  handler: async ({ ctx: { fieldJournal, farmId } }) => {
    const entries = await fieldJournal.listEntries(farmId);
    return { entries };
  },
});

export const createFieldJournalEntryEndpoint = fieldCalendarWrite.build({
  method: "post",
  input: z.object({
    title: z.string().min(1),
    date: ez.dateIn(),
    content: z.string().optional(),
  }),
  output: journalEntrySchema,
  handler: async ({ input, ctx: { fieldJournal, farmId, user } }) => {
    return fieldJournal.createEntry(farmId, user.id, input);
  },
});

export const getFieldJournalEntryEndpoint = fieldCalendarRead.build({
  method: "get",
  input: z.object({ entryId: z.string() }),
  output: journalEntryWithImagesSchema,
  handler: async ({ input, ctx: { fieldJournal } }) => {
    return fieldJournal.getEntry(input.entryId);
  },
});

export const updateFieldJournalEntryEndpoint = fieldCalendarWrite.build({
  method: "patch",
  input: z.object({
    entryId: z.string(),
    title: z.string().min(1).optional(),
    date: ez.dateIn().optional(),
    content: z.string().optional(),
  }),
  output: journalEntrySchema,
  handler: async ({ input, ctx: { fieldJournal } }) => {
    const { entryId, ...updateInput } = input;
    return fieldJournal.updateEntry(entryId, updateInput);
  },
});

export const deleteFieldJournalEntryEndpoint = fieldCalendarWrite.build({
  method: "delete",
  input: z.object({ entryId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx: { fieldJournal } }) => {
    await fieldJournal.deleteEntry(input.entryId);
    return {};
  },
});

export const requestFieldJournalImageSignedUrlEndpoint = fieldCalendarWrite.build({
  method: "post",
  input: z.object({
    journalEntryId: z.string(),
    filename: z.string().min(1),
  }),
  output: z.object({
    signedUrl: z.string(),
    path: z.string(),
  }),
  handler: async ({ input, ctx: { fieldJournal } }) => {
    return fieldJournal.requestSignedImageUrl(input.journalEntryId, input.filename);
  },
});

export const registerFieldJournalImageEndpoint = fieldCalendarWrite.build({
  method: "post",
  input: z.object({
    journalEntryId: z.string(),
    storagePath: z.string().min(1),
  }),
  output: journalImageSchema,
  handler: async ({ input, ctx: { fieldJournal } }) => {
    return fieldJournal.registerImage(input.journalEntryId, input.storagePath);
  },
});

export const deleteFieldJournalImageEndpoint = fieldCalendarWrite.build({
  method: "delete",
  input: z.object({ imageId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx: { fieldJournal } }) => {
    await fieldJournal.deleteImage(input.imageId);
    return {};
  },
});
