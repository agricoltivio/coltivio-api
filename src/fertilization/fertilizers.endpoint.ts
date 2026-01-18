import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getFertilizerByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ fertilizerId: z.string() }),
  output: tables.selectFertilizerSchema,
  handler: async ({ input, ctx: { fertilizers } }) => {
    const fertilizer = await fertilizers.getFertilizerById(input.fertilizerId);
    if (!fertilizer) {
      throw createHttpError(404, "Fertilizer not found");
    }
    return fertilizer;
  },
});

export const getFarmFertilizersEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectFertilizerSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { fertilizers, farmId } }) => {
    const result = await fertilizers.getFertilizersForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createFertilizerEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertFertilizerSchema.omit({ farmId: true, id: true }),
  output: tables.selectFertilizerSchema,
  handler: async ({ input, ctx: { fertilizers } }) => {
    return fertilizers.createFertilizer(input);
  },
});

export const updateFertilizerEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateFertilizerSchema.omit({ id: true, farmId: true }).extend({
    fertilizerId: z.string(),
  }),
  output: tables.selectFertilizerSchema,
  handler: async ({ input, ctx: { fertilizers } }) => {
    return fertilizers.updateFertilizer(input.fertilizerId, input);
  },
});

export const deleteFertilizerEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ fertilizerId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { fertilizerId },
    ctx: { fertilizers: fertilizer },
  }) => {
    await fertilizer.deleteFertilizer(fertilizerId);
    return {};
  },
});

export const fertilizerInUseEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ fertilizerId: z.string() }),
  output: z.object({ inUse: z.boolean() }),
  handler: async ({ input: { fertilizerId }, ctx: { fertilizers } }) => {
    const inUse = await fertilizers.fertilizerInUse(fertilizerId);
    return { inUse };
  },
});
