import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import {
  multiPolygonSchema,
  tillageActionSchema,
  tillageReasonSchema,
} from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";
import { ensureDateRange } from "../date-utils";

// API Schemas - decoupled from database schema for stable API contract
const plotBasicSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  localId: z.string().nullable(),
  usage: z.number().nullable(),
  additionalUsages: z.string().nullable(),
  cuttingDate: ez.dateOut().nullable(),
  size: z.number(),
  additionalNotes: z.string().nullable(),
});

export const tillageSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  createdAt: ez.dateOut(),
  createdBy: z.string().nullable(),
  plotId: z.string(),
  geometry: multiPolygonSchema,
  size: z.number(),
  reason: tillageReasonSchema.nullable(),
  action: tillageActionSchema,
  customAction: z.string().nullable(),
  date: ez.dateOut(),
  additionalNotes: z.string().nullable(),
  plot: plotBasicSchema,
});

const tillagesResponseSchema = tillageSchema;

const tillageCreateSchema = z.object({
  plotId: z.string(),
  geometry: multiPolygonSchema,
  size: z.number(),
  reason: tillageReasonSchema.optional().nullable(),
  action: tillageActionSchema,
  customAction: z.string().optional(),
  date: ez.dateIn(),
  additionalNotes: z.string().optional(),
});

export const getTillageByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ tillageId: z.string() }),
  output: tillagesResponseSchema,
  handler: async ({ input, ctx: { tillages } }) => {
    const tillage = await tillages.getTillageById(input.tillageId);
    if (!tillage) {
      throw createHttpError(404, "Tillage not found");
    }
    return tillage;
  },
});
export const getPlotTillagesEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({
    plotId: z.string(),
  }),
  output: z.object({
    result: z.array(tillagesResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { tillages, farmId } }) => {
    const result = await tillages.getTillagesForPlot(input.plotId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getFarmTillagesEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({
    fromDate: ez.dateIn().optional(),
    toDate: ez.dateIn().optional(),
  }),
  output: z.object({
    result: z.array(tillagesResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { tillages, farmId } }) => {
    const { from, to } = ensureDateRange(input.fromDate, input.toDate);
    const result = await tillages.getTillagesForFarm(farmId, from, to);
    return {
      result,
      count: result.length,
    };
  },
});

export const createTillageEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tillageCreateSchema,
  output: tillagesResponseSchema,
  handler: async ({ input, ctx: { tillages, user } }) => {
    return tillages.createTillage({ ...input, createdBy: user.id });
  },
});

export const createTillagesEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    reason: tillageReasonSchema,
    action: tillageActionSchema,
    customAction: z.string().optional(),
    date: ez.dateIn(),
    additionalNotes: z.string().optional(),
    plots: z
      .object({
        plotId: z.string(),
        geometry: multiPolygonSchema,
        size: z.number(),
      })
      .array(),
  }),
  output: z.object({
    result: z.array(tillagesResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { tillages, user } }) => {
    const result = await tillages.createTillages({
      ...input,
      createdBy: user.id,
    });
    return {
      result,
      count: result.length,
    };
  },
});

export const updateTillageEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tillageCreateSchema.omit({ plotId: true }).partial().extend({
    tillageId: z.string(),
    customAction: z.string().optional().nullable(),
  }),
  output: tillagesResponseSchema,
  handler: async ({ input, ctx: { tillages } }) => {
    return tillages.updateTillage(input.tillageId, input);
  },
});

export const deleteTillageEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ tillageId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { tillageId }, ctx: { tillages: tillage } }) => {
    await tillage.deleteTillage(tillageId);
    return {};
  },
});

export const getTillagesYearsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(z.string()),
    count: z.number(),
  }),
  handler: async ({ ctx: { tillages } }) => {
    const result = await tillages.getTillagesYears();
    return {
      result,
      count: result.length,
    };
  },
});

const tillagePresetSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  reason: tillageReasonSchema.nullable(),
  action: tillageActionSchema,
  customAction: z.string().nullable(),
});

export const getTillagePresetsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tillagePresetSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { tillages } }) => {
    const result = await tillages.getTillagePresets();
    return { result, count: result.length };
  },
});

export const getTillagePresetByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ presetId: z.string() }),
  output: tillagePresetSchema,
  handler: async ({ input, ctx: { tillages } }) => {
    const preset = await tillages.getTillagePresetById(input.presetId);
    if (!preset) {
      throw createHttpError(404, "Tillage preset not found");
    }
    return preset;
  },
});

export const createTillagePresetEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    name: z.string(),
    reason: tillageReasonSchema.optional(),
    action: tillageActionSchema,
    customAction: z.string().optional(),
  }),
  output: tillagePresetSchema,
  handler: async ({ input, ctx: { tillages } }) => {
    return tillages.createTillagePreset(input);
  },
});

export const updateTillagePresetEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: z.object({
    presetId: z.string(),
    name: z.string().optional(),
    reason: tillageReasonSchema.optional().nullable(),
    action: tillageActionSchema.optional(),
    customAction: z.string().optional().nullable(),
  }),
  output: tillagePresetSchema,
  handler: async ({ input: { presetId, ...data }, ctx: { tillages } }) => {
    return tillages.updateTillagePreset(presetId, data);
  },
});

export const deleteTillagePresetEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ presetId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { presetId }, ctx: { tillages } }) => {
    await tillages.deleteTillagePreset(presetId);
    return {};
  },
});
