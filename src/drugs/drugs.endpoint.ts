import createHttpError from "http-errors";
import { z } from "zod";
import { animalTypeSchema } from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const drugTreatmentSchema = z.object({
  id: z.string(),
  drugId: z.string(),
  animalType: animalTypeSchema,
  dosePerKg: z.number(),
  milkWaitingDays: z.number().int(),
  meatWaitingDays: z.number().int(),
});

export const drugSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  notes: z.string().nullable(),
  drugTreatment: z.array(drugTreatmentSchema),
});

const createDrugTreatmentSchema = z.object({
  animalType: animalTypeSchema,
  dosePerKg: z.number().positive(),
  milkWaitingDays: z.number().int().min(0),
  meatWaitingDays: z.number().int().min(0),
});

const createDrugSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
  drugTreatment: z.array(createDrugTreatmentSchema),
});

const updateDrugSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional(),
  drugTreatment: z.array(createDrugTreatmentSchema).optional(),
});

export const getDrugByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ drugId: z.string() }),
  output: drugSchema,
  handler: async ({ input, ctx: { drugs } }) => {
    const drug = await drugs.getDrugById(input.drugId);
    if (!drug) {
      throw createHttpError(404, "Drug not found");
    }
    return drug;
  },
});

export const getFarmDrugsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(drugSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { drugs, farmId } }) => {
    const result = await drugs.getDrugsForFarm(farmId);
    return { result, count: result.length };
  },
});

export const createDrugEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createDrugSchema,
  output: drugSchema,
  handler: async ({ input, ctx: { drugs } }) => {
    return drugs.createDrug(input);
  },
});

export const updateDrugEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateDrugSchema.extend({ drugId: z.string() }),
  output: drugSchema,
  handler: async ({ input, ctx: { drugs } }) => {
    const { drugId, ...data } = input;
    return drugs.updateDrug(drugId, data);
  },
});

export const deleteDrugEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ drugId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { drugId }, ctx: { drugs } }) => {
    await drugs.deleteDrug(drugId);
    return {};
  },
});

export const drugInUseEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ drugId: z.string() }),
  output: z.object({ inUse: z.boolean() }),
  handler: async ({ input, ctx: { drugs } }) => {
    const inUse = await drugs.drugInUse(input.drugId);
    return { inUse };
  },
});
