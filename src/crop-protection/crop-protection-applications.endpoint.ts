import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import {
  cropProtectionApplicationMethodSchema,
  cropProtectionUnitSchema,
  multiPolygonSchema,
} from "../db/schema";
import { cropProtectionEquipmentSchema } from "../equipment/crop-protection-equipment.endpoint";
import { cropProtectionProductSchema } from "./crop-protection-products.endpoint";
import { farmEndpointFactory } from "../endpoint-factory";
import { ensureDateRange } from "../utils";

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

export const cropProtectionApplicationSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  createdAt: ez.dateOut(),
  createdBy: z.string().nullable(),
  plotId: z.string(),
  dateTime: ez.dateOut(),
  equipmentId: z.string().nullable(),
  productId: z.string(),
  geometry: multiPolygonSchema,
  size: z.number(),
  method: cropProtectionApplicationMethodSchema,
  amountPerApplication: z.number(),
  numberOfApplications: z.number(),
  unit: cropProtectionUnitSchema,
  additionalNotes: z.string().nullable(),
  equipment: cropProtectionEquipmentSchema.nullable(),
  product: cropProtectionProductSchema,
  plot: plotBasicSchema,
});

const cropProtectionApplicationsResponseSchema =
  cropProtectionApplicationSchema;

const cropProtectionApplicationCreateSchema = z.object({
  plotId: z.string(),
  dateTime: ez.dateIn(),
  equipmentId: z.string().optional(),
  productId: z.string(),
  geometry: multiPolygonSchema,
  size: z.number(),
  method: cropProtectionApplicationMethodSchema,
  amountPerApplication: z.number(),
  numberOfApplications: z.number(),
  unit: cropProtectionUnitSchema,
  additionalNotes: z.string().optional(),
});

export const getCropProtectionApplicationByIdEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({ cropProtectionApplicationId: z.string() }),
    output: cropProtectionApplicationsResponseSchema,
    handler: async ({ input, ctx: { cropProtectionApplications } }) => {
      const cropProtectionApplication =
        await cropProtectionApplications.getCropProtectionApplicationById(
          input.cropProtectionApplicationId,
        );
      if (!cropProtectionApplication) {
        throw createHttpError(404, "CropProtectionApplication not found");
      }
      return cropProtectionApplication;
    },
  });

export const getPlotCropProtectionApplicationsEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({
      plotId: z.string(),
    }),
    output: z.object({
      result: z.array(cropProtectionApplicationsResponseSchema),
      count: z.number(),
    }),
    handler: async ({ input, ctx: { cropProtectionApplications, farmId } }) => {
      const result =
        await cropProtectionApplications.getCropProtectionApplicationsForPlot(
          input.plotId,
        );
      return {
        result,
        count: result.length,
      };
    },
  });

export const getFarmCropProtectionApplicationsEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({
      fromDate: ez.dateIn().optional(),
      toDate: ez.dateIn().optional(),
    }),
    output: z.object({
      result: z.array(cropProtectionApplicationsResponseSchema),
      count: z.number(),
    }),
    handler: async ({ input, ctx: { cropProtectionApplications, farmId } }) => {
      const { from, to } = ensureDateRange(input.fromDate, input.toDate);
      const result =
        await cropProtectionApplications.getCropProtectionApplicationsForFarm(
          farmId,
          from,
          to,
        );
      return {
        result,
        count: result.length,
      };
    },
  });

export const createCropProtectionApplicationEndpoint =
  farmEndpointFactory.build({
    method: "post",
    input: cropProtectionApplicationCreateSchema,
    output: cropProtectionApplicationsResponseSchema,
    handler: async ({ input, ctx: { cropProtectionApplications, user } }) => {
      return cropProtectionApplications.createCropProtectionApplication({
        ...input,
        createdBy: user.id,
      });
    },
  });

export const createCropProtectionApplicationsEndpoint =
  farmEndpointFactory.build({
    method: "post",
    input: z.object({
      method: cropProtectionApplicationMethodSchema,
      dateTime: ez.dateIn(),
      equipmentId: z.string().optional(),
      productId: z.string(),
      unit: cropProtectionUnitSchema,
      additionalNotes: z.string().optional(),
      amountPerApplication: z.number(),
      plots: z
        .object({
          plotId: z.string(),
          geometry: multiPolygonSchema,
          size: z.number(),
          numberOfApplications: z.number(),
        })
        .array(),
    }),
    output: z.object({
      result: z.array(cropProtectionApplicationsResponseSchema),
      count: z.number(),
    }),
    handler: async ({ input, ctx: { cropProtectionApplications, user } }) => {
      const result =
        await cropProtectionApplications.createCropProtectionApplications({
          ...input,
          createdBy: user.id,
        });
      return {
        result,
        count: result.length,
      };
    },
  });

export const updateCropProtectionApplicationEndpoint =
  farmEndpointFactory.build({
    method: "patch",
    input: cropProtectionApplicationCreateSchema
      .omit({ plotId: true })
      .partial()
      .extend({
        cropProtectionApplicationId: z.string(),
      }),
    output: cropProtectionApplicationsResponseSchema,
    handler: async ({ input, ctx: { cropProtectionApplications } }) => {
      return cropProtectionApplications.updateCropProtectionApplication(
        input.cropProtectionApplicationId,
        input,
      );
    },
  });

export const deleteCropProtectionApplicationEndpoint =
  farmEndpointFactory.build({
    method: "delete",
    input: z.object({ cropProtectionApplicationId: z.string() }),
    output: z.object({}),
    handler: async ({
      input: { cropProtectionApplicationId },
      ctx: { cropProtectionApplications: cropProtectionApplication },
    }) => {
      await cropProtectionApplication.deleteCropProtectionApplication(
        cropProtectionApplicationId,
      );
      return {};
    },
  });

export const getCropProtectionApplicationYearsEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
      result: z.array(z.string()),
      count: z.number(),
    }),
    handler: async ({ ctx: { cropProtectionApplications } }) => {
      const result =
        await cropProtectionApplications.getCropProtectionApplicationYears();
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
        }),
      ),
    }),
  ),
});

export const getCropProtectionApplicationSummaryForFarmEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({}),
    output: cropProtectionApplicationSummaryResponseSchema,
    handler: async ({ ctx: { cropProtectionApplications, farmId } }) => {
      return cropProtectionApplications.getCropProtectionApplicationSummaryForFarm();
    },
  });

export const getCropProtectionApplicationSummaryForPlotEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({ plotId: z.string() }),
    output: cropProtectionApplicationSummaryResponseSchema,
    handler: async ({
      input: { plotId },
      ctx: { cropProtectionApplications },
    }) => {
      return cropProtectionApplications.getCropProtectionApplicationSummaryForPlot(
        plotId,
      );
    },
  });
