import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import { cropSchema } from "../crops/crops.endpoint";
import { ensureDateRange } from "../date-utils";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

const plotMinimalSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const harvestSchema = z.object({
  id: z.string(),
  date: ez.dateOut(),
  farmId: z.string(),
  additionalNotes: z.string().nullable(),
  conservationMethod: tables.conservationMethodEnumSchema.nullable(),
  unit: tables.harvestUnitsSchema,
  kilosPerUnit: z.number(),
  numberOfUnits: z.number(),
  harvestCount: z.number().nullable(),
  geometry: tables.multiPolygonSchema,
  cropId: z.string(),
  crop: cropSchema.omit({ family: true }),
  plotId: z.string(),
  plot: plotMinimalSchema,
  size: z.number(),
  createdAt: ez.dateOut(),
  createdBy: z.string().nullable(),
});

export const getHarvestsForFarmEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({
    fromDate: ez.dateIn().optional(),
    toDate: ez.dateIn().optional(),
  }),
  output: z.object({
    result: z.array(harvestSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { harvests, farmId } }) => {
    const { from, to } = ensureDateRange(input.fromDate, input.toDate);
    const result = await harvests.getHarvestsForFarm(farmId, from, to);
    return { result, count: result.length };
  },
});

export const getHarvestsForPlotEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: z.object({
    result: z.array(harvestSchema.omit({ plot: true })),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { harvests } }) => {
    const result = await harvests.getHarvestsForPlot(input.plotId);
    return { result, count: result.length };
  },
});

const harvestSummaryResponseSchema = z.object({
  monthlyHarvests: z.array(
    z.object({
      year: z.number(),
      month: z.number(),
      producedQuantities: z.array(
        z.object({
          totalAmountInKilos: z.number(),
          forageName: z.string(),
          conservationMethod: z.string().optional().nullable(),
          producedUnits: z.array(
            z.object({
              unit: z.string(),
              totalAmountInKilos: z.number(),
              totalProducedUnits: z.number(),
            })
          ),
        })
      ),
    })
  ),
});

export const getHarvestSummaryForFarmEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: harvestSummaryResponseSchema,
  handler: async ({ ctx: { harvests, farmId } }) => {
    const result = await harvests.getHarvestSummaryForFarm(farmId);
    return result;
  },
});

export const getHarvestSummaryForPlotEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: harvestSummaryResponseSchema,
  handler: async ({ input, ctx: { harvests } }) => {
    const result = await harvests.getHarvestSummaryForPlot(input.plotId);
    return result;
  },
});

export const getHarvestByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ harvestId: z.string() }),
  output: harvestSchema,
  handler: async ({ input, ctx: { harvests } }) => {
    const harvest = await harvests.getHarvestById(input.harvestId);
    if (!harvest) {
      throw createHttpError(404, "Forage Harvest not found");
    }
    return harvest;
  },
});

const createHarvestsSchema = z.object({
  date: ez.dateIn(),
  cropId: z.string(),
  conservationMethod: tables.conservationMethodEnumSchema.optional().nullable(),
  kilosPerUnit: z.number(),
  harvestCount: z.number().optional(),
  additionalNotes: z.string().optional(),
  unit: tables.harvestUnitsSchema,
  plots: z
    .object({
      plotId: z.string(),
      geometry: tables.multiPolygonSchema,
      size: z.number(),
      numberOfUnits: z.number(),
    })
    .array(),
});

export const createHarvestsEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createHarvestsSchema,
  output: z.object({
    result: harvestSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { harvests, user } }) => {
    const result = await harvests.createHarvests({
      ...input,
      createdBy: user.id,
    });
    return {
      result,
      count: result.length,
    };
  },
});

export const deleteHarvestEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ harvestId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { harvestId }, ctx: { harvests } }) => {
    await harvests.deleteHarvest(harvestId);
    return {};
  },
});

export const getHarvestYearsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(z.string()),
    count: z.number(),
  }),
  handler: async ({ ctx: { harvests } }) => {
    const result = await harvests.getHarvestYears();
    return { result, count: result.length };
  },
});

const harvestPresetSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  unit: tables.harvestUnitsSchema,
  kilosPerUnit: z.number(),
  conservationMethod: tables.conservationMethodEnumSchema.nullable(),
});

export const getHarvestPresetsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(harvestPresetSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { harvests } }) => {
    const result = await harvests.getHarvestPresets();
    return { result, count: result.length };
  },
});

export const getHarvestPresetByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ presetId: z.string() }),
  output: harvestPresetSchema,
  handler: async ({ input, ctx: { harvests } }) => {
    const preset = await harvests.getHarvestPresetById(input.presetId);
    if (!preset) {
      throw createHttpError(404, "Harvest preset not found");
    }
    return preset;
  },
});

export const createHarvestPresetEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    name: z.string(),
    unit: tables.harvestUnitsSchema,
    kilosPerUnit: z.number(),
    conservationMethod: tables.conservationMethodEnumSchema.optional().nullable(),
  }),
  output: harvestPresetSchema,
  handler: async ({ input, ctx: { harvests } }) => {
    return harvests.createHarvestPreset(input);
  },
});

export const updateHarvestPresetEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: z.object({
    presetId: z.string(),
    name: z.string().optional(),
    unit: tables.harvestUnitsSchema.optional(),
    kilosPerUnit: z.number().optional(),
    conservationMethod: tables.conservationMethodEnumSchema.optional().nullable(),
  }),
  output: harvestPresetSchema,
  handler: async ({ input: { presetId, ...data }, ctx: { harvests } }) => {
    return harvests.updateHarvestPreset(presetId, data);
  },
});

export const deleteHarvestPresetEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ presetId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { presetId }, ctx: { harvests } }) => {
    await harvests.deleteHarvestPreset(presetId);
    return {};
  },
});
