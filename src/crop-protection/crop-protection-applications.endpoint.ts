import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import {
  cropProtectionApplicationMethodSchema,
  cropProtectionApplicationUnitSchema,
  cropProtectionUnitSchema,
  multiPolygonSchema,
} from "../db/schema";
import { cropProtectionProductSchema } from "./crop-protection-products.endpoint";
import { permissionFarmEndpoint } from "../endpoint-factory";
import { ensureDateRange } from "../date-utils";
import {
  createCropProtectionApplication,
  createCropProtectionApplicationPreset,
  createCropProtectionApplications,
  deleteCropProtectionApplication,
  deleteCropProtectionApplicationPreset,
  getCropProtectionApplicationById,
  getCropProtectionApplicationPresetById,
  getCropProtectionApplicationPresets,
  getCropProtectionApplicationsForFarm,
  getCropProtectionApplicationsForPlot,
  getCropProtectionApplicationSummaryForFarm,
  getCropProtectionApplicationSummaryForPlot,
  getCropProtectionApplicationYears,
  updateCropProtectionApplication,
  updateCropProtectionApplicationPreset,
} from "./crop-protection-applications";

const cropProtectionRead = permissionFarmEndpoint("field_calendar", "read");
const cropProtectionWrite = permissionFarmEndpoint("field_calendar", "write");

const plotMinimalSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const cropProtectionApplicationSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  createdAt: ez.dateOut(),
  createdBy: z.string().nullable(),
  plotId: z.string(),
  dateTime: ez.dateOut(),
  productId: z.string(),
  geometry: multiPolygonSchema,
  size: z.number(),
  method: cropProtectionApplicationMethodSchema.nullable(),
  unit: cropProtectionApplicationUnitSchema,
  amountPerUnit: z.number(),
  numberOfUnits: z.number(),
  additionalNotes: z.string().nullable(),
  product: cropProtectionProductSchema,
  plot: plotMinimalSchema,
});

const cropProtectionApplicationsResponseSchema = cropProtectionApplicationSchema;

const cropProtectionApplicationCreateSchema = z.object({
  plotId: z.string(),
  dateTime: ez.dateIn(),
  productId: z.string(),
  geometry: multiPolygonSchema,
  size: z.number(),
  method: cropProtectionApplicationMethodSchema.optional().nullable(),
  amountPerUnit: z.number(),
  numberOfUnits: z.number(),
  unit: cropProtectionApplicationUnitSchema,
  additionalNotes: z.string().optional(),
});

export const getCropProtectionApplicationByIdEndpoint = cropProtectionRead.build({
  method: "get",
  input: z.object({ cropProtectionApplicationId: z.string() }),
  output: cropProtectionApplicationsResponseSchema,
  handler: async ({ input }) => {
    const cropProtectionApplication = await getCropProtectionApplicationById(input.cropProtectionApplicationId);
    if (!cropProtectionApplication) {
      throw createHttpError(404, "CropProtectionApplication not found");
    }
    return cropProtectionApplication;
  },
});

export const getPlotCropProtectionApplicationsEndpoint = cropProtectionRead.build({
  method: "get",
  input: z.object({
    plotId: z.string(),
  }),
  output: z.object({
    result: z.array(cropProtectionApplicationsResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input }) => {
    const result = await getCropProtectionApplicationsForPlot(input.plotId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getFarmCropProtectionApplicationsEndpoint = cropProtectionRead.build({
  method: "get",
  input: z.object({
    fromDate: ez.dateIn().optional(),
    toDate: ez.dateIn().optional(),
  }),
  output: z.object({
    result: z.array(cropProtectionApplicationsResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { farmId } }) => {
    const { from, to } = ensureDateRange(input.fromDate, input.toDate);
    const result = await getCropProtectionApplicationsForFarm(farmId, from, to);
    return {
      result,
      count: result.length,
    };
  },
});

export const createCropProtectionApplicationEndpoint = cropProtectionWrite.build({
  method: "post",
  input: cropProtectionApplicationCreateSchema,
  output: cropProtectionApplicationsResponseSchema,
  handler: async ({ input, ctx: { user, farmId } }) => {
    return createCropProtectionApplication({ ...input, createdBy: user.id }, farmId);
  },
});

export const createCropProtectionApplicationsEndpoint = cropProtectionWrite.build({
  method: "post",
  input: z.object({
    method: cropProtectionApplicationMethodSchema,
    dateTime: ez.dateIn(),
    equipmentId: z.string().optional(),
    productId: z.string(),
    unit: cropProtectionApplicationUnitSchema,
    additionalNotes: z.string().optional(),
    amountPerUnit: z.number(),
    plots: z
      .object({
        plotId: z.string(),
        geometry: multiPolygonSchema,
        size: z.number(),
        numberOfUnits: z.number(),
      })
      .array(),
  }),
  output: z.object({
    result: z.array(cropProtectionApplicationsResponseSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { user, farmId } }) => {
    const result = await createCropProtectionApplications({ ...input, createdBy: user.id }, farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const updateCropProtectionApplicationEndpoint = cropProtectionWrite.build({
  method: "patch",
  input: cropProtectionApplicationCreateSchema.omit({ plotId: true }).partial().extend({
    cropProtectionApplicationId: z.string(),
  }),
  output: cropProtectionApplicationsResponseSchema,
  handler: async ({ input }) => {
    return updateCropProtectionApplication(input.cropProtectionApplicationId, input);
  },
});

export const deleteCropProtectionApplicationEndpoint = cropProtectionWrite.build({
  method: "delete",
  input: z.object({ cropProtectionApplicationId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { cropProtectionApplicationId } }) => {
    await deleteCropProtectionApplication(cropProtectionApplicationId);
    return {};
  },
});

export const getCropProtectionApplicationYearsEndpoint = cropProtectionRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(z.string()),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getCropProtectionApplicationYears(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

const cropProtectionApplicationSummaryResponseSchema = z.object({
  monthlyApplications: z.array(
    z.object({
      year: z.number(),
      month: z.number(),
      appliedCropProtections: z.array(
        z.object({
          totalAmount: z.number(),
          productName: z.string(),
          unit: cropProtectionUnitSchema,
        })
      ),
    })
  ),
});

export const getCropProtectionApplicationSummaryForFarmEndpoint = cropProtectionRead.build({
  method: "get",
  input: z.object({}),
  output: cropProtectionApplicationSummaryResponseSchema,
  handler: async ({ ctx: { farmId } }) => {
    return getCropProtectionApplicationSummaryForFarm(farmId);
  },
});

export const getCropProtectionApplicationSummaryForPlotEndpoint = cropProtectionRead.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: cropProtectionApplicationSummaryResponseSchema,
  handler: async ({ input: { plotId } }) => {
    return getCropProtectionApplicationSummaryForPlot(plotId);
  },
});

const cropProtectionApplicationPresetSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  method: cropProtectionApplicationMethodSchema.nullable(),
  unit: cropProtectionApplicationUnitSchema,
  customUnit: z.string().nullable(),
  amountPerUnit: z.number(),
});

export const getCropProtectionApplicationPresetsEndpoint = cropProtectionRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(cropProtectionApplicationPresetSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getCropProtectionApplicationPresets(farmId);
    return { result, count: result.length };
  },
});

export const getCropProtectionApplicationPresetByIdEndpoint = cropProtectionRead.build({
  method: "get",
  input: z.object({ presetId: z.string() }),
  output: cropProtectionApplicationPresetSchema,
  handler: async ({ input }) => {
    const preset = await getCropProtectionApplicationPresetById(input.presetId);
    if (!preset) {
      throw createHttpError(404, "Crop protection application preset not found");
    }
    return preset;
  },
});

export const createCropProtectionApplicationPresetEndpoint = cropProtectionWrite.build({
  method: "post",
  input: z.object({
    name: z.string(),
    method: cropProtectionApplicationMethodSchema.optional().nullable(),
    unit: cropProtectionApplicationUnitSchema,
    customUnit: z.string().optional(),
    amountPerUnit: z.number(),
  }),
  output: cropProtectionApplicationPresetSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return createCropProtectionApplicationPreset(input, farmId);
  },
});

export const updateCropProtectionApplicationPresetEndpoint = cropProtectionWrite.build({
  method: "patch",
  input: z.object({
    presetId: z.string(),
    name: z.string().optional(),
    method: cropProtectionApplicationMethodSchema.nullable().optional(),
    unit: cropProtectionApplicationUnitSchema.optional(),
    customUnit: z.string().optional().nullable(),
    amountPerUnit: z.number().optional(),
  }),
  output: cropProtectionApplicationPresetSchema,
  handler: async ({ input: { presetId, ...data } }) => {
    return updateCropProtectionApplicationPreset(presetId, data);
  },
});

export const deleteCropProtectionApplicationPresetEndpoint = cropProtectionWrite.build({
  method: "delete",
  input: z.object({ presetId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { presetId } }) => {
    await deleteCropProtectionApplicationPreset(presetId);
    return {};
  },
});
