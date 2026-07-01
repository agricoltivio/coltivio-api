import createHttpError from "http-errors";
import { z } from "zod";
import { fertilizerTypeSchema, fertilizerUnitSchema } from "../db/schema";
import { permissionFarmEndpoint } from "../endpoint-factory";
import {
  createFertilizer,
  deleteFertilizer,
  fertilizerInUse,
  getFertilizerById,
  getFertilizersForFarm,
  updateFertilizer,
} from "./fertilizers";

const fertilizationRead = permissionFarmEndpoint("field_calendar", "read");
const fertilizationWrite = permissionFarmEndpoint("field_calendar", "write");

// API Schemas - decoupled from database schema for stable API contract
export const fertilizerSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: fertilizerTypeSchema,
  unit: fertilizerUnitSchema,
});

const createFertilizerSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: fertilizerTypeSchema,
  unit: fertilizerUnitSchema,
  defaultSpreaderId: z.string().optional(),
});

const updateFertilizerSchema = createFertilizerSchema.partial();

export const getFertilizerByIdEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({ fertilizerId: z.string() }),
  output: fertilizerSchema,
  handler: async ({ input }) => {
    const fertilizer = await getFertilizerById(input.fertilizerId);
    if (!fertilizer) {
      throw createHttpError(404, "Fertilizer not found");
    }
    return fertilizer;
  },
});

export const getFarmFertilizersEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(fertilizerSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getFertilizersForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createFertilizerEndpoint = fertilizationWrite.build({
  method: "post",
  input: createFertilizerSchema,
  output: fertilizerSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return createFertilizer(input, farmId);
  },
});

export const updateFertilizerEndpoint = fertilizationWrite.build({
  method: "patch",
  input: updateFertilizerSchema.extend({
    fertilizerId: z.string(),
  }),
  output: fertilizerSchema,
  handler: async ({ input }) => {
    return updateFertilizer(input.fertilizerId, input);
  },
});

export const deleteFertilizerEndpoint = fertilizationWrite.build({
  method: "delete",
  input: z.object({ fertilizerId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { fertilizerId } }) => {
    await deleteFertilizer(fertilizerId);
    return {};
  },
});

export const fertilizerInUseEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({ fertilizerId: z.string() }),
  output: z.object({ inUse: z.boolean() }),
  handler: async ({ input: { fertilizerId } }) => {
    const inUse = await fertilizerInUse(fertilizerId);
    return { inUse };
  },
});
