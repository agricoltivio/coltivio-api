import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getPlotByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: tables.selectPlotSchema,
  handler: async ({ input, options: { plots } }) => {
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
    result: z.array(tables.selectPlotSchema),
    count: z.number(),
  }),
  handler: async ({ options: { plots, farmId } }) => {
    const result = await plots.getPlotsForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createPlotEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertPlotSchema.omit({ farmId: true, id: true }),
  output: tables.selectPlotSchema,
  handler: async ({ input, options: { plots } }) => {
    return plots.createPlot(input);
  },
});

export const updatePlotEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updatePlotSchema.omit({ id: true, farmId: true }).extend({
    plotId: z.string(),
  }),
  output: tables.selectPlotSchema,
  handler: async ({ input, options: { plots } }) => {
    return plots.updatePlot(input.plotId, input);
  },
});

export const deletePlotEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ plotId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { plotId }, options: { plots: plot } }) => {
    await plot.deletePlot(plotId);
    return {};
  },
});

export const syncMissingLocalIdsEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({}),
  output: z.object({}),
  handler: async ({ options: { plots } }) => {
    await plots.syncMissingLocalIds();
    return {};
  },
});
