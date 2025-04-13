import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

const harvestResponseSchema = tables.selectHarvestSchema.merge(
  z.object({
    createdAt: ez.dateOut(),
    date: ez.dateOut(),
    machinery: tables.selectHarvestingMachinerySchema.nullable(),
    crop: tables.selectCropSchema,
    plot: tables.selectPlotSchema.omit({ cropRotations: true }),
  })
);

export const getHarvestsForFarmEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({
    fromDate: ez
      .dateIn()
      .optional()
      .default(new Date(2020, 0, 1).toISOString()),
    toDate: ez
      .dateIn()
      .optional()
      .default(new Date(5000, 0, 1).toISOString()),
  }),
  output: z.object({
    result: z.array(harvestResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, options: { harvests, farmId } }) => {
    const result = await harvests.getHarvestsForFarm(
      farmId,
      input.fromDate,
      input.toDate
    );
    return { result, count: result.length };
  },
});

export const getHarvestsForPlotEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: z.object({
    result: z.array(harvestResponseSchema.omit({ plot: true })),
    count: z.number(),
  }),
  handler: async ({ input, options: { harvests } }) => {
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
          conservationMethod: z.string(),
          producedUnits: z.array(
            z.object({
              processingMethod: z.string(),
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
  handler: async ({ input, options: { harvests, farmId } }) => {
    const result = await harvests.getHarvestSummaryForFarm(farmId);
    return result;
  },
});

export const getHarvestSummaryForPlotEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: harvestSummaryResponseSchema,
  handler: async ({ input, options: { harvests } }) => {
    const result = await harvests.getHarvestSummaryForPlot(input.plotId);
    return result;
  },
});

export const getHarvestByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ harvestId: z.string() }),
  output: harvestResponseSchema,
  handler: async ({ input, options: { harvests } }) => {
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
  processingType: tables.processingTypeEnumSchema,
  conservationMethod: tables.conservationMethodEnumSchema,
  kilosPerUnit: z.number(),
  harvestCount: z.number().optional(),
  additionalNotes: z.string().optional(),
  machineryId: z.string().optional(),
  plots: z
    .object({
      plotId: z.string(),
      geometry: tables.multiPolygonSchema,
      size: z.number(),
      producedUnits: z.number(),
    })
    .array(),
});

export const createHarvestsEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createHarvestsSchema,
  output: z.object({
    result: harvestResponseSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, options: { harvests, user } }) => {
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
  handler: async ({ input: { harvestId }, options: { harvests } }) => {
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
  handler: async ({ options: { harvests } }) => {
    const result = await harvests.getHarvestYears();
    return { result, count: result.length };
  },
});
