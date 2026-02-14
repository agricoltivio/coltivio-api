import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import {
  animalCateogrySchema,
  animalSexSchema,
  animalTypeSchema,
  animalUsageSchema,
  deathReasonSchema,
  frequencySchema,
  outdoorScheduleTypeSchema,
  weekdaySchema,
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
  dateOfBirth: ez.dateOut(),
  registered: z.boolean(),
  requiresCategoryOverride: z.boolean().nullable(),
  categoryOverride: animalCateogrySchema.nullable(),
  usage: animalUsageSchema,
  earTagId: z.string().nullable(),
  get earTag() {
    return earTagSchema.nullable();
  },
  motherId: z.string().nullable(),
  fatherId: z.string().nullable(),
  dateOfDeath: ez.dateOut().nullable(),
  deathReason: deathReasonSchema.nullable(),
  herdId: z.string().nullable(),
});

const herdSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
});

const recurrenceSchema = z.object({
  id: z.string(),
  frequency: frequencySchema,
  interval: z.number(),
  byWeekday: z.array(weekdaySchema).nullable(),
  byMonthDay: z.number().nullable(),
  until: z.string().nullable(),
  count: z.number().nullable(),
});

const outdoorScheduleSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  herdId: z.string(),
  startDate: ez.dateOut(),
  endDate: ez.dateOut().nullable(),
  type: outdoorScheduleTypeSchema,
  notes: z.string().nullable(),
  recurrence: recurrenceSchema.nullable(),
});

const herdWithRelationsSchema = herdSchema.extend({
  animals: z.array(animalSchema),
  outdoorSchedules: z.array(outdoorScheduleSchema),
});

const createHerdSchema = z.object({
  name: z.string(),
  animalIds: z.array(z.string()),
});
const updateHerdSchema = createHerdSchema.partial();

const createOutdoorScheduleSchema = z.object({
  startDate: ez.dateIn(),
  endDate: ez.dateIn().optional().nullable(),
  type: outdoorScheduleTypeSchema,
  notes: z.string().optional().nullable(),
  recurrence: z
    .object({
      frequency: frequencySchema,
      interval: z.number(),
      byWeekday: z.array(weekdaySchema).optional().nullable(),
      byMonthDay: z.number().optional().nullable(),
      until: z.string().optional().nullable(),
      count: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const updateOutdoorScheduleSchema = createOutdoorScheduleSchema.partial();

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
  herd: herdSchema.optional().nullable(),
});

const createAnimalSchema = z.object({
  name: z.string(),
  type: animalTypeSchema,
  sex: animalSexSchema,
  dateOfBirth: ez.dateIn(),
  registered: z.boolean(),
  categoryOverride: animalCateogrySchema.optional().nullable(),
  usage: animalUsageSchema,
  earTagId: z.string().optional().nullable(),
  motherId: z.string().optional().nullable(),
  fatherId: z.string().optional().nullable(),
  dateOfDeath: ez.dateIn().optional().nullable(),
  deathReason: deathReasonSchema.optional().nullable(),
  herdId: z.string().optional().nullable(),
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
    result: z.array(
      animalSchema.extend({
        milkAndMeatUsable: z.boolean(),
      }),
    ),
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
  handler: async ({ input, ctx: { animals, farmId, preferredLanguage } }) => {
    const { file, type, skipHeaderRow } = input;
    return animals.importFromExcel(
      file.data,
      type,
      skipHeaderRow,
      farmId,
      preferredLanguage,
    );
  },
});

// --- Outdoor Journal ---

const outdoorJournalEntrySchema = z.object({
  category: animalCateogrySchema,
  startDate: ez.dateOut(),
  endDate: ez.dateOut(),
  animalCount: z.number(),
});

export const getOutdoorJournalEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ fromDate: ez.dateIn(), toDate: ez.dateIn() }),
  output: z.object({
    entries: z.array(outdoorJournalEntrySchema),
    uncategorizedAnimalCount: z.number(),
  }),
  handler: async ({ input, ctx: { animals, farmId } }) => {
    return animals.getOutdoorJournal(farmId, input.fromDate, input.toDate);
  },
});

// --- Herd Endpoints ---

export const getFarmHerdsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(herdWithRelationsSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { animals, farmId } }) => {
    const result = await animals.getHerdsForFarm(farmId);
    return { result, count: result.length };
  },
});

export const createHerdEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createHerdSchema,
  output: herdSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const { animalIds, ...herdData } = input;
    return animals.createHerd(herdData, animalIds);
  },
});

export const getHerdByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ herdId: z.string() }),
  output: herdWithRelationsSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const herd = await animals.getHerdById(input.herdId);
    if (!herd) {
      throw createHttpError(404, "Herd not found");
    }
    return herd;
  },
});

export const updateHerdEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateHerdSchema.extend({ herdId: z.string() }),
  output: herdSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const { herdId, animalIds, ...data } = input;
    return animals.updateHerd(herdId, data, animalIds);
  },
});

export const deleteHerdEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ herdId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { herdId }, ctx: { animals } }) => {
    await animals.deleteHerd(herdId);
    return {};
  },
});

// --- Outdoor Schedule Endpoints ---

export const getHerdOutdoorSchedulesEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ herdId: z.string() }),
  output: z.object({
    result: z.array(outdoorScheduleSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { animals } }) => {
    const result = await animals.getOutdoorSchedulesForHerd(input.herdId);
    return { result, count: result.length };
  },
});

export const createOutdoorScheduleEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createOutdoorScheduleSchema.extend({ herdId: z.string() }),
  output: outdoorScheduleSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const { herdId, ...data } = input;
    return animals.createOutdoorSchedule(herdId, data);
  },
});

export const getOutdoorScheduleByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ outdoorScheduleId: z.string() }),
  output: outdoorScheduleSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const schedule = await animals.getOutdoorScheduleById(
      input.outdoorScheduleId,
    );
    if (!schedule) {
      throw createHttpError(404, "Outdoor schedule not found");
    }
    return schedule;
  },
});

export const updateOutdoorScheduleEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateOutdoorScheduleSchema.extend({
    outdoorScheduleId: z.string(),
  }),
  output: outdoorScheduleSchema,
  handler: async ({ input, ctx: { animals } }) => {
    const { outdoorScheduleId, ...data } = input;
    return animals.updateOutdoorSchedule(outdoorScheduleId, data);
  },
});

export const deleteOutdoorScheduleEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ outdoorScheduleId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { outdoorScheduleId }, ctx: { animals } }) => {
    await animals.deleteOutdoorSchedule(outdoorScheduleId);
    return {};
  },
});
