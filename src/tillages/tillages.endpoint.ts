import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";
import { ez } from "express-zod-api";

const tillagesResponseSchema = tables.selectTillageSchema.merge(
  z.object({
    createdAt: ez.dateOut(),
    date: ez.dateOut(),
    geometry: tables.multiPolygonSchema,
    equipment: tables.selectTillageEquipmentSchema.nullable(),
    plot: tables.selectPlotSchema.omit({ cropRotations: true, geometry: true }),
  })
);

const tillageCreateSchema = tables.insertTillageSchema
  .omit({
    farmId: true,
    id: true,
    createdAt: true,
    createdBy: true,
  })
  .extend({
    date: ez.dateIn(),
    geometry: tables.multiPolygonSchema,
  });

export const getTillageByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ tillageId: z.string() }),
  output: tillagesResponseSchema,
  handler: async ({ input, options: { tillages } }) => {
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
  handler: async ({ input, options: { tillages, farmId } }) => {
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
    result: z.array(tillagesResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, options: { tillages, farmId } }) => {
    const result = await tillages.getTillagesForFarm(
      farmId,
      input.fromDate,
      input.toDate
    );
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
  handler: async ({ input, options: { tillages, user } }) => {
    return tillages.createTillage({ ...input, createdBy: user.id });
  },
});

export const createTillagesEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    reason: z.enum(tables.tillageReason.enumValues),
    action: z.enum(tables.tillageAction.enumValues),
    date: ez.dateIn(),
    equipmentId: z.string().optional(),
    plots: z
      .object({
        plotId: z.string(),
        geometry: tables.multiPolygonSchema,
        size: z.number(),
      })
      .array(),
  }),
  output: z.object({
    result: z.array(tillagesResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, options: { tillages, user } }) => {
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
  }),
  output: tillagesResponseSchema,
  handler: async ({ input, options: { tillages } }) => {
    return tillages.updateTillage(input.tillageId, input);
  },
});

export const deleteTillageEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ tillageId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { tillageId }, options: { tillages: tillage } }) => {
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
  handler: async ({ options: { tillages } }) => {
    const result = await tillages.getTillagesYears();
    return {
      result,
      count: result.length,
    };
  },
});
