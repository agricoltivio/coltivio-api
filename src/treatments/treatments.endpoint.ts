import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import { farmEndpointFactory } from "../endpoint-factory";
import { animalSchema } from "../animals/animals.endpoint";
import { drugSchema } from "../drugs/drugs.endpoint";

export const treatmentSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  animalId: z.string(),
  drugId: z.string().nullable(),
  date: ez.dateOut(),
  name: z.string(),
  notes: z.string().nullable(),
  milkUsableDate: ez.dateOut().nullable(),
  meatUsableDate: ez.dateOut().nullable(),
  createdAt: ez.dateOut(),
  createdBy: z.string().nullable(),
});

export const treatmentWithRelationsSchema = treatmentSchema.extend({
  get animal() {
    return animalSchema;
  },
  get drug() {
    return drugSchema.nullable();
  },
});

const createTreatmentSchema = z.object({
  animalId: z.string(),
  drugId: z.string().nullable(),
  date: ez.dateIn(),
  name: z.string().min(1),
  notes: z.string().optional(),
  milkUsableDate: ez.dateIn().nullable(),
  meatUsableDate: ez.dateIn().nullable(),
});

const updateTreatmentSchema = z.object({
  treatmentId: z.string(),
  animalId: z.string().optional(),
  drugId: z.string().nullable(),
  date: ez.dateIn().optional(),
  name: z.string().min(1).optional(),
  notes: z.string().optional(),
  milkUsableDate: ez.dateIn().nullable(),
  meatUsableDate: ez.dateIn().nullable(),
});

export const getTreatmentByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ treatmentId: z.string() }),
  output: treatmentWithRelationsSchema,
  handler: async ({ input, ctx: { treatments } }) => {
    const treatment = await treatments.getTreatmentById(input.treatmentId);
    if (!treatment) {
      throw createHttpError(404, "Treatment not found");
    }
    return treatment;
  },
});

export const getFarmTreatmentsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(treatmentWithRelationsSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { treatments, farmId } }) => {
    const result = await treatments.getTreatmentsForFarm(farmId);
    return { result: result as any, count: result.length };
  },
});

export const getAnimalTreatmentsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ animalId: z.string() }),
  output: z.object({
    result: z.array(treatmentWithRelationsSchema.omit({ animal: true })),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { treatments } }) => {
    const result = await treatments.getTreatmentsForAnimal(input.animalId);
    return { result: result as any, count: result.length };
  },
});

export const createTreatmentEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createTreatmentSchema,
  output: treatmentSchema,
  handler: async ({ input, ctx: { treatments, user } }) => {
    return treatments.createTreatment(input, user.id);
  },
});

export const updateTreatmentEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateTreatmentSchema,
  output: treatmentSchema,
  handler: async ({ input, ctx: { treatments } }) => {
    const { treatmentId, ...data } = input;
    return treatments.updateTreatment(treatmentId, data);
  },
});

export const deleteTreatmentEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ treatmentId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { treatmentId }, ctx: { treatments } }) => {
    await treatments.deleteTreatment(treatmentId);
    return {};
  },
});
