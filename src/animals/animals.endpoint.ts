import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import {
  animalSexSchema,
  animalTypeSchema,
  deathReasonSchema,
} from "../db/schema";
import { earTagSchema } from "../ear-tags/ear-tags.endpoint";
import { farmEndpointFactory } from "../endpoint-factory";
import { treatmentSchema } from "../treatments/treatments.endpoint";

// API Schemas - decoupled from database schema for stable API contract
export const animalSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  type: animalTypeSchema,
  sex: animalSexSchema,
  dateOfBirth: ez.dateOut().nullable(),
  registered: z.boolean(),
  earTagId: z.string().nullable(),
  get earTag() {
    return earTagSchema.nullable();
  },
  motherId: z.string().nullable(),
  fatherId: z.string().nullable(),
  dateOfDeath: ez.dateOut().nullable(),
  deathReason: deathReasonSchema.nullable(),
});

const animalWithRelationsSchema = animalSchema.extend({
  get earTag() {
    return earTagSchema.nullable();
  },
  // if we do animalSchema.nullable(), all schemas referencing animal in this object will be nullable
  mother: z.union([animalSchema, z.null()]),
  father: z.union([animalSchema, z.null()]),
  childrenAsMother: z.array(animalSchema),
  childrenAsFather: z.array(animalSchema),
  get treatments() {
    return z.array(treatmentSchema);
  },
});

const createAnimalSchema = z.object({
  name: z.string(),
  type: animalTypeSchema,
  sex: animalSexSchema,
  dateOfBirth: ez.dateIn().optional(),
  registered: z.boolean(),
  earTagId: z.string().optional().nullable(),
  motherId: z.string().optional().nullable(),
  fatherId: z.string().optional().nullable(),
  dateOfDeath: ez.dateIn().optional().nullable(),
  deathReason: deathReasonSchema.optional().nullable(),
});

const updateAnimalSchema = createAnimalSchema.partial();

export const getAnimalByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ animalId: z.string() }),
  output: animalWithRelationsSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const animal = await animals.getAnimalById(input.animalId);
    if (!animal) {
      throw createHttpError(404, "Animal not found");
    }
    return animal;
  },
});

export const getFarmAnimalsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({
    animalTypes: z.array(animalTypeSchema).optional(),
    onlyLiving: z
      .string()
      .optional()
      .transform((value) => value === "true")
      .default(true),
  }),
  output: z.object({
    result: z.array(animalSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { animals, farmId } }) => {
    const result = await animals.getAnimalsForFarm(
      farmId,
      input.onlyLiving,
      input.animalTypes,
    );
    return {
      result,
      count: result.length,
    };
  },
});

export const getLivingAnimalsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(animalSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { animals, farmId } }) => {
    const result = await animals.getLivingAnimalsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createAnimalEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createAnimalSchema,
  output: animalSchema,
  handler: async ({ input, ctx: { animals } }) => {
    return animals.createAnimal(input);
  },
});

export const updateAnimalEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateAnimalSchema.extend({
    animalId: z.string(),
  }),
  output: animalSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const { animalId, ...data } = input;
    return animals.updateAnimal(animalId, data);
  },
});

export const updateAnimalsEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: z.object({
    animals: z.array(
      updateAnimalSchema.extend({
        id: z.string(),
      }),
    ),
  }),
  output: z.object({
    result: z.array(animalSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { animals } }) => {
    const result = await animals.updateAnimals(input.animals);
    return {
      result,
      count: result.length,
    };
  },
});

export const deleteAnimalEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ animalId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { animalId }, ctx: { animals } }) => {
    await animals.deleteAnimal(animalId);
    return {};
  },
});

export const getAnimalChildrenEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ animalId: z.string() }),
  output: z.object({
    result: z.array(animalSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { animals } }) => {
    const result = await animals.getChildrenOfAnimal(input.animalId);
    return {
      result,
      count: result.length,
    };
  },
});

const skippedRowSchema = z.object({
  row: z.number(),
  earTagNumber: z.string().nullable(),
  name: z.string().nullable(),
  reason: z.string(),
});

const importSummarySchema = z.object({
  totalRows: z.number(),
  imported: z.number(),
  skipped: z.number(),
});

export const importAnimalsFromExcelEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    file: ez.upload(),
    type: animalTypeSchema,
    skipHeaderRow: z
      .string()
      .optional()
      .transform((val) => val !== "false")
      .default(true),
  }),
  output: z.object({
    skipped: z.array(skippedRowSchema),
    summary: importSummarySchema,
  }),
  handler: async ({ input, ctx: { animals, farmId } }) => {
    const { file, type, skipHeaderRow } = input;
    return animals.importFromExcel(file.data, type, skipHeaderRow, farmId);
  },
});
