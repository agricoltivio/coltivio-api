import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import { cropSchema, cropFamilySchema } from "../crops/crops.endpoint";
import { ensureDateRange } from "../date-utils";
import { frequencySchema, weekdaySchema } from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const cropRotationSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  plotId: z.string(),
  cropId: z.string(),
  sowingDate: ez.dateOut().nullable(),
  fromDate: ez.dateOut(),
  toDate: ez.dateOut(),
  crop: cropSchema,
});

const recurrenceSchema = z.object({
  frequency: frequencySchema,
  interval: z.number().int().min(1).default(1),
  byWeekday: z.array(weekdaySchema).optional(),
  byMonthDay: z.number().int().min(1).max(31).optional(),
  until: ez.dateIn().optional(),
  count: z.number().int().min(1).optional(),
});

const createCropRotationSchema = z.object({
  plotId: z.string(),
  cropId: z.string(),
  sowingDate: ez.dateIn().optional(),
  fromDate: ez.dateIn(),
  toDate: ez.dateIn(),
  recurrence: recurrenceSchema.optional(),
});

const updateCropRotationSchema = z.object({
  cropId: z.string().optional(),
  sowingDate: ez.dateIn().optional(),
  fromDate: ez.dateIn().optional(),
  toDate: ez.dateIn().optional(),
  recurrence: recurrenceSchema.optional().nullable(),
});

export const getCropRotationsForPlotEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({
    plotId: z.string(),
    fromDate: ez.dateIn(),
    toDate: ez.dateIn(),
  }),
  output: z.object({
    result: z.array(cropRotationSchema),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { cropRotations } }) => {
    const result = await cropRotations.getCropRotationsForPlot(
      input.plotId,
      input.fromDate,
      input.toDate,
    );
    return {
      result,
      count: result.length,
    };
  },
});

export const getCurrentCropRotationsForPlotsEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({
      plotIds: z.preprocess(
        (val) => (typeof val === "string" ? [val] : val),
        z.array(z.string()).min(1),
      ),
      onlyCurrent: z
        .string()
        .optional()
        .transform((val) => val === "true")
        .default(true),
      fromDate: ez.dateIn(),
      toDate: ez.dateIn(),
    }),
    output: z.object({
      result: z.array(cropRotationSchema),
      count: z.number(),
    }),
    handler: async ({ input, ctx: { cropRotations } }) => {
      console.log(input.plotIds, input.onlyCurrent);
      const result = await cropRotations.getCropRotationsForPlots(
        input.plotIds,
        input.onlyCurrent,
        input.fromDate,
        input.toDate,
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

export const createCropRotationsByPlotEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    plotId: z.string(),
    crops: z.array(
      z.object({
        cropId: z.string(),
        sowingDate: ez.dateIn().optional(),
        fromDate: ez.dateIn(),
        toDate: ez.dateIn(),
        recurrence: recurrenceSchema.optional(),
      }),
    ),
  }),
  output: z.object({
    result: cropRotationSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { cropRotations } }) => {
    const result = await cropRotations.createCropRotationsByPlot(input);
    return {
      result,
      count: result.length,
    };
  },
});

export const createCropRotationsPlanEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    plots: z.array(
      z.object({
        plotId: z.string(),
        crops: z.array(
          z.object({
            cropId: z.string(),
            sowingDate: ez.dateIn().optional(),
            fromDate: ez.dateIn(),
            toDate: ez.dateIn(),
            recurrence: recurrenceSchema.optional(),
          }),
        ),
      }),
    ),
  }),
  output: z.object({
    result: cropRotationSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { cropRotations } }) => {
    const result = await cropRotations.createCropRotationsPlan(input);
    return {
      result,
      count: result.length,
    };
  },
});

export const createCropRotationsByCropEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    cropId: z.string(),
    plots: z.array(createCropRotationSchema),
  }),
  output: z.object({
    result: cropRotationSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { cropRotations } }) => {
    const result = await cropRotations.createCropRotationsByCrop(input);
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
