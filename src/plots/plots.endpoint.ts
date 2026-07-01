import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import { multiPolygonSchema } from "../db/schema";
import { cropRotationSchema } from "../crop-rotations/crop-rotations.endpoint";
import { permissionFarmEndpoint } from "../endpoint-factory";
import {
  getPlotById,
  getPlotsForFarm,
  createPlot,
  updatePlot,
  deletePlot,
  splitPlot,
  mergePlots,
  syncMissingLocalIds,
} from "./plots";

const plotsRead = permissionFarmEndpoint("field_calendar", "read");
const plotsWrite = permissionFarmEndpoint("field_calendar", "write");

export const plotSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  localId: z.string().nullable(),
  usage: z.number().nullable(),
  cuttingDate: ez.dateOut().nullable(),
  geometry: multiPolygonSchema,
  size: z.number(),
  additionalNotes: z.string().nullable(),
  currentCropRotation: cropRotationSchema.nullable(),
});

const createPlotSchema = z.object({
  name: z.string(),
  localId: z.string().optional(),
  usage: z.number().optional(),
  additionalUsages: z.string().optional(),
  cuttingDate: ez.dateIn().nullable().optional(),
  geometry: multiPolygonSchema,
  size: z.number(),
  additionalNotes: z.string().optional(),
});

const updatePlotSchema = z.object({
  name: z.string().optional(),
  localId: z.string().optional(),
  usage: z.number().optional(),
  additionalUsages: z.string().optional(),
  cuttingDate: ez.dateIn().nullable().optional(),
  geometry: multiPolygonSchema.optional(),
  size: z.number().optional(),
  additionalNotes: z.string().optional(),
});

export const getPlotByIdEndpoint = plotsRead.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: plotSchema,
  handler: async ({ input }) => {
    const plot = await getPlotById(input.plotId);
    if (!plot) {
      throw createHttpError(404, "Plot not found");
    }
    return plot;
  },
});

export const getFarmPlotsEndpoint = plotsRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(plotSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getPlotsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createPlotEndpoint = plotsWrite.build({
  method: "post",
  input: createPlotSchema,
  output: plotSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return createPlot(input, farmId);
  },
});

export const updatePlotEndpoint = plotsWrite.build({
  method: "patch",
  input: updatePlotSchema.extend({
    plotId: z.string(),
  }),
  output: plotSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return updatePlot(input.plotId, input, farmId);
  },
});

export const deletePlotEndpoint = plotsWrite.build({
  method: "delete",
  input: z.object({ plotId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { plotId }, ctx: { farmId } }) => {
    await deletePlot(plotId, farmId);
    return {};
  },
});

const subPlotSchema = z.object({
  geometry: multiPolygonSchema,
  name: z.string(),
  size: z.number(),
});

const splitPlotInputSchema = z.discriminatedUnion("strategy", [
  z.object({
    plotId: z.string(),
    strategy: z.literal("keep_reference"),
    originalPlotName: z.string().optional(),
    subPlots: z.array(subPlotSchema).min(1),
  }),
  z.object({
    plotId: z.string(),
    strategy: z.literal("delete_and_migrate"),
    migrateToIndex: z.number().int().min(0),
    subPlots: z.array(subPlotSchema).min(1),
  }),
]);

export const splitPlotEndpoint = plotsWrite.build({
  method: "post",
  input: splitPlotInputSchema,
  output: z.object({ result: z.array(plotSchema) }),
  handler: async ({ input, ctx: { farmId } }) => {
    const { plotId, subPlots, ...strategyOptions } = input;
    const result = await splitPlot(plotId, subPlots, farmId, strategyOptions);
    return { result };
  },
});

const mergePlotsInputSchema = z.discriminatedUnion("strategy", [
  z.object({
    strategy: z.literal("keep_reference"),
    plotIds: z.array(z.string()).min(2),
    name: z.string(),
    localId: z.string().optional(),
    usage: z.number().optional(),
    additionalUsages: z.string().optional(),
    cuttingDate: ez.dateIn().nullable().optional(),
    additionalNotes: z.string().optional(),
  }),
  z.object({
    strategy: z.literal("delete_and_migrate"),
    plotIds: z.array(z.string()).min(2),
    name: z.string(),
    localId: z.string().optional(),
    usage: z.number().optional(),
    additionalUsages: z.string().optional(),
    cuttingDate: ez.dateIn().nullable().optional(),
    additionalNotes: z.string().optional(),
  }),
]);

export const mergePlotsEndpoint = plotsWrite.build({
  method: "post",
  input: mergePlotsInputSchema,
  output: plotSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    const { strategy, plotIds, ...plotData } = input;
    return mergePlots(plotIds, plotData, farmId, { strategy });
  },
});

export const syncMissingLocalIdsEndpoint = plotsWrite.build({
  method: "post",
  input: z.object({}),
  output: z.object({}),
  handler: async () => {
    await syncMissingLocalIds();
    return {};
  },
});
