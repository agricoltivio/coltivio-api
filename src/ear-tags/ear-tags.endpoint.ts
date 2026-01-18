import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

const earTagWithAssignmentSchema = tables.selectEarTagSchema.extend({
  animalId: z.string().nullable(),
});

export const getEarTagsEndpoint = farmEndpointFactory.build({
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

export const getAvailableEarTagsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectEarTagSchema),
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

export const createEarTagRangeEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    fromNumber: z.string().min(1),
    toNumber: z.string().min(1),
  }),
  output: z.object({
    result: z.array(tables.selectEarTagSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { earTags } }) => {
    const result = await earTags.createEarTagRange(
      input.fromNumber,
      input.toNumber,
    );
    return {
      result,
      count: result.length,
    };
  },
});

export const deleteEarTagRangeEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({
    fromNumber: z.string().min(1),
    toNumber: z.string().min(1),
  }),
  output: z.object({
    deletedCount: z.number(),
    skippedAssigned: z.array(z.string()),
  }),
  handler: async ({ input, ctx: { earTags, farmId } }) => {
    return earTags.deleteEarTagRange(
      farmId,
      input.fromNumber,
      input.toNumber,
    );
  },
});
