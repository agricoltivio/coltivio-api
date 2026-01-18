import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";
import { ez } from "express-zod-api";
import { ensureDateRange } from "../utils";

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
    reason: z.enum(tables.tillageReason.enumValues),
    action: z.enum(tables.tillageAction.enumValues),
    date: ez.dateIn(),
    additionalNotes: z.string().optional(),
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
