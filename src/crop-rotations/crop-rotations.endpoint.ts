import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import { cropSchema } from "../crops/crops.endpoint";
import { ensureDateRange } from "../date-utils";
import { permissionFarmEndpoint } from "../endpoint-factory";
import {
  createCropRotation,
  createCropRotationsByCrop,
  createCropRotationsByPlot,
  deleteCropRotation,
  getCropRotationById,
  getCropRotationsForFarm,
  getCropRotationsForPlot,
  getCropRotationsForPlots,
  getCropRotationYears,
  planCropRotations,
  updateCropRotation,
} from "./crop-rotations";

const cropRotationsRead = permissionFarmEndpoint("field_calendar", "read");
const cropRotationsWrite = permissionFarmEndpoint("field_calendar", "write");

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
  interval: z.number().int().min(1).default(1),
  until: ez.dateIn().optional(),
});

const recurrenceOutSchema = z.object({
  id: z.string(),
  interval: z.number(),
  until: ez.dateOut().nullable(),
});

export const cropRotationWithRecurrenceSchema = cropRotationSchema.extend({
  recurrence: recurrenceOutSchema.nullable(),
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

export const getCropRotationsForPlotEndpoint = cropRotationsRead.build({
  method: "get",
  input: z.object({
    plotId: z.string(),
    fromDate: ez.dateIn(),
    toDate: ez.dateIn(),
  }),
  output: z.object({
    result: z.array(cropRotationWithRecurrenceSchema),
    count: z.number(),
  }),
  handler: async ({ input }) => {
    const result = await getCropRotationsForPlot(input.plotId, input.fromDate, input.toDate);
    return {
      result,
      count: result.length,
    };
  },
});

const booleanQueryParam = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((val) => (val === undefined ? defaultValue : val === "true"));

export const getCropRotationsForPlotsEndpoint = cropRotationsRead.build({
  method: "get",
  input: z.object({
    plotIds: z.preprocess((val) => (typeof val === "string" ? [val] : val), z.array(z.string()).min(1)),
    onlyCurrent: booleanQueryParam(true),
    expand: booleanQueryParam(true),
    withRecurrences: booleanQueryParam(false),
    fromDate: ez.dateIn(),
    toDate: ez.dateIn(),
  }),
  output: z.object({
    result: z.array(cropRotationWithRecurrenceSchema),
    count: z.number(),
  }),
  handler: async ({ input }) => {
    const result = await getCropRotationsForPlots(input.plotIds, input.onlyCurrent, input.fromDate, input.toDate, {
      expand: input.expand,
      withRecurrences: input.withRecurrences,
    });
    return {
      result,
      count: result.length,
    };
  },
});

export const getCropRotationByIdEndpoint = cropRotationsRead.build({
  method: "get",
  input: z.object({ rotationId: z.string() }),
  output: cropRotationWithRecurrenceSchema,
  handler: async ({ input: { rotationId } }) => {
    const result = await getCropRotationById(rotationId);
    if (!result) {
      throw createHttpError(404, "Crop rotation not found");
    }
    return result;
  },
});

export const getCropRotationsForFarmEndpoint = cropRotationsRead.build({
  method: "get",
  input: z.object({
    fromDate: ez.dateIn().optional(),
    toDate: ez.dateIn().optional(),
    expand: booleanQueryParam(true),
    withRecurrences: booleanQueryParam(false),
  }),
  output: z.object({
    result: z.array(
      cropRotationWithRecurrenceSchema.extend({
        plot: z.object({ name: z.string() }),
      })
    ),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { farmId } }) => {
    const { from, to } = ensureDateRange(input.fromDate, input.toDate);
    const result = await getCropRotationsForFarm(farmId, from, to, {
      expand: input.expand,
      withRecurrences: input.withRecurrences,
    });
    return {
      result,
      count: result.length,
    };
  },
});

export const createCropRotationEndpoint = cropRotationsWrite.build({
  method: "post",
  input: createCropRotationSchema,
  output: cropRotationSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    return createCropRotation(input, farmId);
  },
});

export const createCropRotationsByPlotEndpoint = cropRotationsWrite.build({
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
      })
    ),
  }),
  output: z.object({
    result: cropRotationSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { farmId } }) => {
    const result = await createCropRotationsByPlot(input, farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const planCropRotationsEndpoint = cropRotationsWrite.build({
  method: "patch",
  input: z.object({
    plots: z.array(
      z.object({
        plotId: z.string(),
        rotations: z.array(
          z.object({
            cropId: z.string(),
            sowingDate: ez.dateIn().optional(),
            fromDate: ez.dateIn(),
            toDate: ez.dateIn(),
            recurrence: recurrenceSchema.optional(),
          })
        ),
      })
    ),
  }),
  output: z.object({
    result: cropRotationSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { farmId } }) => {
    try {
      const result = await planCropRotations(input, farmId);
      return { result, count: result.length };
    } catch (err) {
      if (err instanceof Error && err.message.includes("Overlapping")) {
        throw createHttpError(409, err.message);
      }
      throw err;
    }
  },
});

export const createCropRotationsByCropEndpoint = cropRotationsWrite.build({
  method: "post",
  input: z.object({
    cropId: z.string(),
    plots: z.array(createCropRotationSchema),
  }),
  output: z.object({
    result: cropRotationSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { farmId } }) => {
    const result = await createCropRotationsByCrop(input, farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const updateCropRotationEndpoint = cropRotationsWrite.build({
  method: "patch",
  input: updateCropRotationSchema.extend({ rotationId: z.string() }),
  output: cropRotationSchema,
  handler: async ({ input: { rotationId, ...data }, ctx: { farmId } }) => {
    return updateCropRotation(rotationId, data, farmId);
  },
});

export const deleteCropRotationEndpoint = cropRotationsWrite.build({
  method: "delete",
  input: z.object({ rotationId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { rotationId } }) => {
    await deleteCropRotation(rotationId);
    return {};
  },
});

export const getCropRotationYearsEndpoint = cropRotationsRead.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(z.string()),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const result = await getCropRotationYears(farmId);
    return {
      result,
      count: result.length,
    };
  },
});
