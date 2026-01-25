import createHttpError from "http-errors";
import { ez } from "express-zod-api";
import { z } from "zod";
import { cropSchema } from "../crops/crops.endpoint";
import { farmEndpointFactory } from "../endpoint-factory";
import { ensureDateRange } from "../utils";

export const cropRotationSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  plotId: z.string(),
  cropId: z.string(),
  sowingDate: ez.dateOut().nullable(),
  fromDate: ez.dateOut(),
  toDate: ez.dateOut().nullable(),
  crop: cropSchema,
});

const createCropRotationSchema = z.object({
  plotId: z.string(),
  cropId: z.string(),
  sowingDate: ez.dateIn().optional(),
  fromDate: ez.dateIn(),
  toDate: ez.dateIn().optional(),
});

const updateCropRotationSchema = z.object({
  cropId: z.string().optional(),
  sowingDate: ez.dateIn().optional(),
  fromDate: ez.dateIn().optional(),
  toDate: ez.dateIn().optional(),
});

export const getCropRotationsForPlotEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: z.object({
    result: z.array(cropRotationSchema),
    count: z.number(),
  }),
  handler: async ({ input: { plotId }, ctx: { cropRotations } }) => {
    const result = await cropRotations.getCropRotationsForPlot(plotId);
    return {
      result,
      count: result.length,
    };
  },
});

export const getCurrentCropRotationsForPlotsEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({ plotIds: z.array(z.string()).min(1) }),
    output: z.object({
      result: z.array(cropRotationSchema),
      count: z.number(),
    }),
    handler: async ({ input, ctx: { cropRotations } }) => {
      const result = await cropRotations.getCurreentCropRotationsForPlots(
        input.plotIds,
      );
      return {
        result,
        count: result.length,
      };
    },
  });

export const getCropRotationByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ rotationId: z.string() }),
  output: cropRotationSchema,
  handler: async ({ input: { rotationId }, ctx: { cropRotations } }) => {
    const result = await cropRotations.getCropRotationById(rotationId);
    if (!result) {
      throw createHttpError(404, "Crop rotation not found");
    }
    return result;
  },
});

export const getCropRotationsForFarmEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({
    fromDate: ez.dateIn().optional(),
    toDate: ez.dateIn().optional(),
  }),
  output: z.object({
    result: z.array(
      cropRotationSchema.extend({
        plot: z.object({ name: z.string() }),
      }),
    ),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { cropRotations } }) => {
    const { from, to } = ensureDateRange(input.fromDate, input.toDate);
    const result = await cropRotations.getCropRotationsForFarm(from, to);
    return {
      result,
      count: result.length,
    };
  },
});

export const createCropRotationEndpoint = farmEndpointFactory.build({
  method: "post",
  input: createCropRotationSchema,
  output: cropRotationSchema,
  handler: async ({ input, ctx: { cropRotations } }) => {
    return cropRotations.createCropRotation(input);
  },
});

export const createCropRotationsEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    cropId: z.string(),
    fromDate: ez.dateIn(),
    toDate: ez.dateIn().optional(),
    plotIds: z.array(z.string()).min(1),
  }),
  output: z.object({
    result: cropRotationSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { cropRotations } }) => {
    const result = await cropRotations.createCropRotations(input);
    return {
      result,
      count: result.length,
    };
  },
});

export const updateCropRotationEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateCropRotationSchema.extend({ rotationId: z.string() }),
  output: cropRotationSchema,
  handler: async ({
    input: { rotationId, ...data },
    ctx: { cropRotations },
  }) => {
    return cropRotations.updateCropRotation(rotationId, data);
  },
});

export const deleteCropRotationEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ rotationId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { rotationId }, ctx: { cropRotations } }) => {
    await cropRotations.deleteCropRotation(rotationId);
    return {};
  },
});

export const getCropRotationYearsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(z.string()),
    count: z.number(),
  }),
  handler: async ({ ctx: { cropRotations } }) => {
    const result = await cropRotations.getCropRotationYears();
    return {
      result,
      count: result.length,
    };
  },
});
