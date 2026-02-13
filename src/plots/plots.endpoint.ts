import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import { multiPolygonSchema } from "../db/schema";
import { cropRotationSchema } from "../crop-rotations/crop-rotations.endpoint";
import { farmEndpointFactory } from "../endpoint-factory";

export const plotSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  localId: z.string().nullable(),
  usage: z.number().nullable(),
  additionalUsages: z.string().nullable(),
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

export const getPlotByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: plotSchema,
  handler: async ({ input, ctx: { plots } }) => {
    const plot = await plots.getPlotById(input.plotId);
    if (!plot) {
      throw createHttpError(404, "Plot not found");
    }
    return plot;
  },
});

export const getFarmPlotsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(plotSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { plots, farmId } }) => {
    const result = await plots.getPlotsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createPlotEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createPlotSchema,
  output: plotSchema,
  handler: async ({ input, ctx: { plots } }) => {
    return plots.createPlot(input);
  },
});

export const updatePlotEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updatePlotSchema.extend({
    plotId: z.string(),
  }),
  output: plotSchema,
  handler: async ({ input, ctx: { plots } }) => {
    return plots.updatePlot(input.plotId, input);
  },
});

export const deletePlotEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ plotId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { plotId }, ctx: { plots: plot } }) => {
    await plot.deletePlot(plotId);
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

export const splitPlotEndpoint = farmEndpointFactory.build({
  method: "post",
  input: splitPlotInputSchema,
  output: z.object({ result: z.array(plotSchema) }),
  handler: async ({ input, ctx: { plots } }) => {
    const { plotId, subPlots, ...strategyOptions } = input;
    const result = await plots.splitPlot(plotId, subPlots, strategyOptions);
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
    geometry: multiPolygonSchema,
    size: z.number(),
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
    geometry: multiPolygonSchema,
    size: z.number(),
    additionalNotes: z.string().optional(),
  }),
]);

export const mergePlotsEndpoint = farmEndpointFactory.build({
  method: "post",
  input: mergePlotsInputSchema,
  output: plotSchema,
  handler: async ({ input, ctx: { plots } }) => {
    const { strategy, plotIds, ...plotData } = input;
    return plots.mergePlots(plotIds, plotData, { strategy });
  },
});

export const syncMissingLocalIdsEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({}),
  output: z.object({}),
  handler: async ({ ctx: { plots } }) => {
    await plots.syncMissingLocalIds();
    return {};
  },
});
