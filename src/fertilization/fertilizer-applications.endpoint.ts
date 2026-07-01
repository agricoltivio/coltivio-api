import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import { ensureDateRange } from "../date-utils";
import {
  fertilizationMethodSchema,
  fertilizerApplicationUnitSchema,
  fertilizerUnitSchema,
  multiPolygonSchema,
} from "../db/schema";
import { permissionFarmEndpoint } from "../endpoint-factory";
import {
  createFertilizerApplicationPreset,
  createFertilizerApplications,
  deleteFertilizerApplication,
  deleteFertilizerApplicationPreset,
  getFertilizerApplicationById,
  getFertilizerApplicationPresetById,
  getFertilizerApplicationPresets,
  getFertilizerApplicationsForFarm,
  getFertilizerApplicationsForPlot,
  getFertilizerApplicationSummaryForFarm,
  getFertilizerApplicationSummaryForPlot,
  getFertilizerApplicationYears,
  updateFertilizerApplicationPreset,
} from "./fertilizer-applications";
import { fertilizerSchema } from "./fertilizers.endpoint";

const fertilizationRead = permissionFarmEndpoint("field_calendar", "read");
const fertilizationWrite = permissionFarmEndpoint("field_calendar", "write");

const plotMinimalSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const fertilizerApplicationSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  createdAt: ez.dateOut(),
  createdBy: z.string(),
  plotId: z.string(),
  date: ez.dateOut(),
  unit: fertilizerApplicationUnitSchema,
  method: fertilizationMethodSchema.nullable(),
  amountPerUnit: z.number(),
  numberOfUnits: z.number(),
  fertilizerId: z.string(),
  geometry: multiPolygonSchema,
  size: z.number(),
  additionalNotes: z.string().nullable(),
  plot: plotMinimalSchema,
  fertilizer: fertilizerSchema,
});

const fertilizerApplicationResponseSchema = fertilizerApplicationSchema;

export const getFertilizerApplicationsForFarmEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({
    fromDate: ez.dateIn().optional(),
    toDate: ez.dateIn().optional(),
  }),
  output: z.object({
    result: z.array(fertilizerApplicationResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { farmId } }) => {
    const { from, to } = ensureDateRange(input.fromDate, input.toDate);
    const result = await getFertilizerApplicationsForFarm(farmId, from, to);
    return {
      result,
      count: result.length,
    };
  },
});

export const getFertilizerApplicationsForPlotEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: z.object({
    result: fertilizerApplicationResponseSchema.omit({ plot: true }).array(),
    count: z.number(),
  }),
  handler: async ({ input }) => {
    const result = await getFertilizerApplicationsForPlot(input.plotId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getFertilizerApplicationByIdEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({ fertilizerApplicationId: z.string() }),
  output: fertilizerApplicationResponseSchema,
  handler: async ({ input }) => {
    const fertilizerApplication = await getFertilizerApplicationById(input.fertilizerApplicationId);
    if (!fertilizerApplication) {
      throw createHttpError(404, "Fertilizer Application not found");
    }
    return fertilizerApplication;
  },
});

export const createFertilizerApplicationsEndpoint = fertilizationWrite.build({
  method: "post",
  input: z.object({
    date: ez.dateIn(),
    unit: fertilizerApplicationUnitSchema,
    method: fertilizationMethodSchema.optional(),
    amountPerUnit: z.number(),
    fertilizerId: z.string(),
    additionalNotes: z.string().optional(),
    plots: z
      .object({
        plotId: z.string(),
        numberOfUnits: z.number(),
        geometry: multiPolygonSchema,
        size: z.number(),
      })
      .array(),
  }),
  output: z.object({
    result: fertilizerApplicationResponseSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { user, farmId } }) => {
    const result = await createFertilizerApplications({ ...input, createdBy: user.id }, farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const deleteFertilizerApplicationEndpoint = fertilizationWrite.build({
  method: "delete",
  input: z.object({ fertilizerApplicationId: z.string() }),
  output: z.object({}),
  handler: async ({ input }) => {
    await deleteFertilizerApplication(input.fertilizerApplicationId);
    return {};
  },
});

export const getFertilizerApplicationYearsEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(z.string()),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getFertilizerApplicationYears(farmId);
    return {
      result,
      count: result.length,
    };
  },
});
const fertilizerApplicationSummaryResponseSchema = z.object({
  monthlyApplications: z.array(
    z.object({
      year: z.number(),
      month: z.number(),
      appliedFertilizers: z.array(
        z.object({
          totalAmount: z.number(),
          fertilizerName: z.string(),
          unit: fertilizerUnitSchema,
        })
      ),
    })
  ),
});

export const getFertilizerApplicationSummaryForFarmEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({}),
  output: fertilizerApplicationSummaryResponseSchema,
  handler: async ({ ctx: { farmId } }) => {
    return getFertilizerApplicationSummaryForFarm(farmId);
  },
});

export const getFertilizerApplicationSummaryForPlotEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: fertilizerApplicationSummaryResponseSchema,
  handler: async ({ input }) => {
    return getFertilizerApplicationSummaryForPlot(input.plotId);
  },
});

const fertilizerApplicationPresetSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  fertilizerId: z.string(),
  unit: fertilizerApplicationUnitSchema,
  method: fertilizationMethodSchema.nullable(),
  amountPerUnit: z.number(),
  fertilizer: fertilizerSchema,
});

export const getFertilizerApplicationPresetsEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(fertilizerApplicationPresetSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getFertilizerApplicationPresets(farmId);
    return { result, count: result.length };
  },
});

export const getFertilizerApplicationPresetByIdEndpoint = fertilizationRead.build({
  method: "get",
  input: z.object({ presetId: z.string() }),
  output: fertilizerApplicationPresetSchema,
  handler: async ({ input }) => {
    const preset = await getFertilizerApplicationPresetById(input.presetId);
    if (!preset) {
      throw createHttpError(404, "Fertilizer application preset not found");
    }
    return preset;
  },
});

export const createFertilizerApplicationPresetEndpoint = fertilizationWrite.build({
  method: "post",
  input: z.object({
    name: z.string(),
    fertilizerId: z.string(),
    unit: fertilizerApplicationUnitSchema,
    method: fertilizationMethodSchema.optional(),
    amountPerUnit: z.number(),
  }),
  output: fertilizerApplicationPresetSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return createFertilizerApplicationPreset(input, farmId);
  },
});

export const updateFertilizerApplicationPresetEndpoint = fertilizationWrite.build({
  method: "patch",
  input: z.object({
    presetId: z.string(),
    name: z.string().optional(),
    fertilizerId: z.string().optional(),
    unit: fertilizerApplicationUnitSchema.optional(),
    method: fertilizationMethodSchema.optional().nullable(),
    amountPerUnit: z.number().optional(),
  }),
  output: fertilizerApplicationPresetSchema,
  handler: async ({ input: { presetId, ...data } }) => {
    return updateFertilizerApplicationPreset(presetId, data);
  },
});

export const deleteFertilizerApplicationPresetEndpoint = fertilizationWrite.build({
  method: "delete",
  input: z.object({ presetId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { presetId } }) => {
    await deleteFertilizerApplicationPreset(presetId);
    return {};
  },
});
