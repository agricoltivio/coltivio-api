import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";
import { ez } from "express-zod-api";

export const getCropRotationsForPlotEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ plotId: z.string() }),
  output: z.object({
    result: z.array(tables.selectCropRotationSchema),
    count: z.number(),
  }),
  handler: async ({ input: { plotId }, options: { cropRotations } }) => {
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
      result: z.array(tables.selectCropRotationSchema),
      count: z.number(),
    }),
    handler: async ({ input, options: { cropRotations } }) => {
      const result = await cropRotations.getCurreentCropRotationsForPlots(
        input.plotIds
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
  output: tables.selectCropRotationSchema,
  handler: async ({ input: { rotationId }, options: { cropRotations } }) => {
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
    fromDate: ez
      .dateIn()
      .optional()
      .default(new Date(2020, 0, 1).toISOString()),
    toDate: ez
      .dateIn()
      .optional()
      .default(new Date(5000, 0, 1).toISOString()),
    skipNaturalMeadows: z
      .string()
      .transform((value) => value === "true")
      .default("true"),
  }),
  output: z.object({
    result: z.array(
      tables.selectCropRotationSchema.extend({
        plot: z.object({ name: z.string() }),
      })
    ),
    count: z.number(),
  }),
  handler: async ({ input, options: { cropRotations, farmId } }) => {
    const result = await cropRotations.getCropRotationsForFarm(
      input.fromDate,
      input.toDate,
      input.skipNaturalMeadows
    );
    return {
      result,
      count: result.length,
    };
  },
});

export const createCropRotationEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertCropRotationSchema.omit({ farmId: true }),
  output: tables.selectCropRotationSchema,
  handler: async ({ input, options: { cropRotations } }) => {
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
    result: tables.selectCropRotationSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, options: { cropRotations } }) => {
    const result = await cropRotations.createCropRotations(input);
    return {
      result,
      count: result.length,
    };
  },
});

export const updateCropRotationEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateCropRotationSchema
    .omit({ id: true, plotId: true, farmId: true })
    .extend({ rotationId: z.string() }),
  output: tables.selectCropRotationSchema,
  handler: async ({
    input: { rotationId, ...data },
    options: { cropRotations },
  }) => {
    return cropRotations.updateCropRotation(rotationId, data);
  },
});

export const deleteCropRotationEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ rotationId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { rotationId }, options: { cropRotations } }) => {
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
  handler: async ({ options: { cropRotations } }) => {
    const result = await cropRotations.getCropRotationYears();
    return {
      result,
      count: result.length,
    };
  },
});
