import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";
import { animalGroupSchema } from "./animal-groups.endpoint";

export const outdoorJournalEntrySchema = z.object({
  id: z.string(),
  farmId: z.string(),
  animalGroupId: z.string(),
  startDate: ez.dateOut(),
  endDate: ez.dateOut(),
  animalCount: z.number(),
  animalGroup: animalGroupSchema,
});

const createOutdoorJournalEntrySchema = z.object({
  animalGroupId: z.string(),
  startDate: ez.dateIn(),
  endDate: ez.dateIn(),
  animalCount: z.number().int().positive(),
});

const updateOutdoorJournalEntrySchema = createOutdoorJournalEntrySchema.partial();

export const getOutdoorJournalEntriesEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(outdoorJournalEntrySchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { outdoorJournal, farmId } }) => {
    const result = await outdoorJournal.getForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createOutdoorJournalEntryEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createOutdoorJournalEntrySchema,
  output: outdoorJournalEntrySchema,
  handler: async ({ input, ctx: { outdoorJournal } }) => {
    return outdoorJournal.create(input);
  },
});

export const getOutdoorJournalEntryByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ entryId: z.string() }),
  output: outdoorJournalEntrySchema,
  handler: async ({ input, ctx: { outdoorJournal } }) => {
    const entry = await outdoorJournal.getById(input.entryId);
    if (!entry) {
      throw createHttpError(404, "Outdoor journal entry not found");
    }
    return entry;
  },
});

export const updateOutdoorJournalEntryEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateOutdoorJournalEntrySchema.extend({
    entryId: z.string(),
  }),
  output: outdoorJournalEntrySchema,
  handler: async ({ input, ctx: { outdoorJournal } }) => {
    const { entryId, ...data } = input;
    return outdoorJournal.update(entryId, data);
  },
});

export const deleteOutdoorJournalEntryEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ entryId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { entryId }, ctx: { outdoorJournal } }) => {
    await outdoorJournal.delete(entryId);
    return {};
  },
});

export const getOutdoorJournalCalendarEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({
    from: ez.dateIn(),
    to: ez.dateIn(),
  }),
  output: z.object({
    result: z.array(outdoorJournalEntrySchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { outdoorJournal, farmId } }) => {
    const result = await outdoorJournal.getByDateRange(farmId, input.from, input.to);
    return {
      result,
      count: result.length,
    };
  },
});
