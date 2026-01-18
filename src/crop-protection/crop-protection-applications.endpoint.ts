import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";
import { ez } from "express-zod-api";
import { ensureDateRange } from "../utils";

const cropProtectionApplicationsResponseSchema =
  tables.selectCropProtectionApplicationSchema.merge(
    z.object({
      createdAt: ez.dateOut(),
      dateTime: ez.dateOut(),
      geometry: tables.multiPolygonSchema,
      equipment: tables.selectCropProtectionEquipmentSchema.nullable(),
      product: tables.selectCropProtectionProductSchema,
      plot: tables.selectPlotSchema.omit({
        cropRotations: true,
        geometry: true,
      }),
    })
  );

const cropProtectionApplicationCreateSchema =
  tables.insertCropProtectionApplicationSchema
    .omit({
      farmId: true,
      id: true,
      createdAt: true,
      createdBy: true,
    })
    .extend({
      dateTime: ez.dateIn(),
      geometry: tables.multiPolygonSchema,
    });

export const getCropProtectionApplicationByIdEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({ cropProtectionApplicationId: z.string() }),
    output: cropProtectionApplicationsResponseSchema,
    handler: async ({ input, ctx: { cropProtectionApplications } }) => {
      const cropProtectionApplication =
        await cropProtectionApplications.getCropProtectionApplicationById(
          input.cropProtectionApplicationId
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
    handler: async ({
      input,
      ctx: { cropProtectionApplications, farmId },
    }) => {
      const result =
        await cropProtectionApplications.getCropProtectionApplicationsForPlot(
          input.plotId
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
    handler: async ({
      input,
      ctx: { cropProtectionApplications, farmId },
    }) => {
      const { from, to } = ensureDateRange(input.fromDate, input.toDate);
      const result =
        await cropProtectionApplications.getCropProtectionApplicationsForFarm(
          farmId,
          from,
          to
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
    handler: async ({
      input,
      ctx: { cropProtectionApplications, user },
    }) => {
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
      method: z.enum(tables.cropProtectionApplicationMehtod.enumValues),
      dateTime: ez.dateIn(),
      equipmentId: z.string().optional(),
      productId: z.string(),
      unit: z.enum(tables.cropProtectionUnit.enumValues),
      additionalNotes: z.string().optional(),
      amountPerApplication: z.number(),
      plots: z
        .object({
          plotId: z.string(),
          geometry: tables.multiPolygonSchema,
          size: z.number(),
          numberOfApplications: z.number(),
        })
        .array(),
    }),
    output: z.object({
      result: z.array(cropProtectionApplicationsResponseSchema),
      count: z.number(),
    }),
    handler: async ({
      input,
      ctx: { cropProtectionApplications, user },
    }) => {
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
        input
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
        cropProtectionApplicationId
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
          unit: tables.cropProtectionUnitSchema,
        })
      ),
    })
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
        plotId
      );
    },
  });
