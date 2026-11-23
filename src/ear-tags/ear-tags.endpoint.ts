import createHttpError from "http-errors";
import { z } from "zod";
import { animalSchema } from "../animals/animals.endpoint";
import { permissionFarmEndpoint } from "../endpoint-factory";

const animalsRead = permissionFarmEndpoint("animals", "read");
const animalsWrite = permissionFarmEndpoint("animals", "write");

export const earTagSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  number: z.string(),
});

const earTagWithAssignmentSchema = earTagSchema.extend({
  get animal() {
    return animalSchema.nullable();
  },
});

export const getEarTagsEndpoint = animalsRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(earTagWithAssignmentSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { earTags, farmId } }) => {
    const result = await earTags.getEarTagsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getAvailableEarTagsEndpoint = animalsRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(earTagSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { earTags, farmId } }) => {
    const result = await earTags.getAvailableEarTagsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createEarTagRangeEndpoint = animalsWrite.build({
  method: "post",
  input: z.object({
    fromNumber: z.string().min(1),
    toNumber: z.string().min(1),
    // Any text in front of the numbers, e.g. "CH 120.". With a prefix, fromNumber and toNumber are plain numbers.
    prefix: z.string().optional(),
  }),
  output: z.object({
    result: z.array(earTagSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { earTags } }) => {
    const result = await earTags.createEarTagRange(input.fromNumber, input.toNumber, input.prefix);
    return {
      result,
      count: result.length,
    };
  },
});

export const deleteEarTagRangeEndpoint = animalsWrite.build({
  method: "delete",
  input: z.object({
    fromNumber: z.string().min(1),
    toNumber: z.string().min(1),
    // Any text in front of the numbers, e.g. "CH 120.". With a prefix, fromNumber and toNumber are plain numbers.
    prefix: z.string().optional(),
  }),
  output: z.object({
    deletedCount: z.number(),
    skippedAssigned: z.array(z.string()),
  }),
  handler: async ({ input, ctx: { earTags, farmId } }) => {
    return earTags.deleteEarTagRange(farmId, input.fromNumber, input.toNumber, input.prefix);
  },
});

// Single ear tag by id. Assigned tags are refused (ear_tag_assigned), the animal has to give it up first.
export const deleteEarTagEndpoint = animalsWrite.build({
  method: "delete",
  input: z.object({ earTagId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx: { earTags } }) => {
    const deleted = await earTags.deleteEarTag(input.earTagId);
    if (!deleted) throw createHttpError(404, "Ear tag not found");
    return {};
  },
});

// Changes the number of a single ear tag, also of an assigned one. Another tag with that number: ear_tag_number_taken.
export const updateEarTagEndpoint = animalsWrite.build({
  method: "patch",
  input: z.object({ earTagId: z.string(), number: z.string().trim().min(1) }),
  output: earTagSchema,
  handler: async ({ input, ctx: { earTags } }) => {
    const updated = await earTags.updateEarTagNumber(input.earTagId, input.number);
    if (!updated) throw createHttpError(404, "Ear tag not found");
    return updated;
  },
});
