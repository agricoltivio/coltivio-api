import createHttpError from "http-errors";
import { z } from "zod";
import { cropCategorySchema } from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

// API Schemas - decoupled from database schema for stable API contract
export const cropSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  category: cropCategorySchema,
  variety: z.string().nullable(),
  usageCodes: z.array(z.number()),
  additionalNotes: z.string().nullable(),
});

const createCropSchema = z.object({
  name: z.string(),
  category: cropCategorySchema,
  variety: z.string().optional(),
  usageCodes: z.array(z.number()).default([]),
  additionalNotes: z.string().optional(),
});

const updateCropSchema = createCropSchema.partial();

export const getCropByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ cropId: z.string() }),
  output: cropSchema,
  handler: async ({ input, ctx: { crops } }) => {
    const crop = await crops.getCropById(input.cropId);
    if (!crop) {
      throw createHttpError(404, "Crop not found");
    }
    return crop;
  },
});

export const getFarmCropsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(cropSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { crops, farmId } }) => {
    const result = await crops.geCropsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createCropEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createCropSchema,
  output: cropSchema,
  handler: async ({ input, ctx: { crops } }) => {
    return crops.createCrop(input);
  },
});

export const updateCropEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateCropSchema.extend({
    cropId: z.string(),
  }),
  output: cropSchema,
  handler: async ({ input, ctx: { crops } }) => {
    return crops.updateCrop(input.cropId, input);
  },
});

export const deleteCropEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ cropId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { cropId }, ctx: { crops } }) => {
    await crops.deleteCrop(cropId);
    return {};
  },
});

export const cropInUseEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ cropId: z.string() }),
  output: z.object({ inUse: z.boolean() }),
  handler: async ({ input, ctx: { crops } }) => {
    return {
      inUse: await crops.cropInUse(input.cropId),
    };
  },
});
