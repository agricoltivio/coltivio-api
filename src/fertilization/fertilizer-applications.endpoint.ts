import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import {
  fertilizerUnitSchema,
  fertilizationMethodSchema,
  multiPolygonSchema,
} from "../db/schema";
import { fertilizerSpreaderSchema } from "../equipment/fertilizer-spreaders.endpoint";
import { fertilizerSchema } from "./fertilizers.endpoint";
import { farmEndpointFactory } from "../endpoint-factory";
import { ensureDateRange } from "../date-utils";

const plotMinimalSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const fertilizerApplicationSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  createdAt: ez.dateOut(),
  createdBy: z.string(),
  plotId: z.string(),
  date: ez.dateOut(),
  unit: fertilizerUnitSchema,
  method: fertilizationMethodSchema,
  amountPerApplication: z.number(),
  numberOfApplications: z.number(),
  fertilizerId: z.string(),
  spreaderId: z.string().nullable(),
  geometry: multiPolygonSchema,
  size: z.number(),
  additionalNotes: z.string().nullable(),
  plot: plotMinimalSchema,
  spreader: fertilizerSpreaderSchema.nullable(),
  fertilizer: fertilizerSchema,
});

const fertilizerApplicationResponseSchema = fertilizerApplicationSchema;

export const getFertilizerApplicationsForFarmEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({
      fromDate: ez.dateIn().optional(),
      toDate: ez.dateIn().optional(),
    }),
    output: z.object({
      result: z.array(fertilizerApplicationResponseSchema),
      count: z.number(),
    }),
    handler: async ({ input, ctx: { fertilizerApplications, farmId } }) => {
      const { from, to } = ensureDateRange(input.fromDate, input.toDate);
      const result =
        await fertilizerApplications.getFertilizerApplicationsForFarm(
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

export const getFertilizerApplicationsForPlotEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({ plotId: z.string() }),
    output: z.object({
      result: fertilizerApplicationResponseSchema.omit({ plot: true }).array(),
      count: z.number(),
    }),
    handler: async ({ input, ctx: { fertilizerApplications } }) => {
      const result =
        await fertilizerApplications.getFertilizerApplicationsForPlot(
          input.plotId,
        );

      return {
        result,
        count: result.length,
      };
    },
  });

export const getFertilizerApplicationByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ fertilizerApplicationId: z.string() }),
  output: fertilizerApplicationResponseSchema,
  handler: async ({ input, ctx: { fertilizerApplications } }) => {
    const fertilizerApplication =
      await fertilizerApplications.getFertilizerApplicationById(
        input.fertilizerApplicationId,
      );
    if (!fertilizerApplication) {
      throw createHttpError(404, "Fertilizer Application not found");
    }
    return fertilizerApplication;
  },
});

export const createFertilizerApplicationsEndpoint = farmEndpointFactory.build({
  method: "post",
  input: z.object({
    date: ez.dateIn(),
    unit: fertilizerUnitSchema,
    method: fertilizationMethodSchema,
    amountPerApplication: z.number(),
    fertilizerId: z.string(),
    spreaderId: z.string().optional(),
    additionalNotes: z.string().optional(),
    plots: z
      .object({
        plotId: z.string(),
        numberOfApplications: z.number(),
        geometry: multiPolygonSchema,
        size: z.number(),
      })
      .array(),
  }),
  output: z.object({
    result: fertilizerApplicationResponseSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, ctx: { user, fertilizerApplications } }) => {
    const result = await fertilizerApplications.createFertilizerApplications({
      ...input,
      createdBy: user.id,
    });
    return {
      result,
      count: result.length,
    };
  },
});

export const deleteFertilizerApplicationEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ fertilizerApplicationId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx: { fertilizerApplications } }) => {
    await fertilizerApplications.deleteFertilizerApplication(
      input.fertilizerApplicationId,
    );
    return {};
  },
});

export const getFertilizerApplicationYearsEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(z.string()),
    count: z.number(),
  }),
  handler: async ({ ctx: { fertilizerApplications } }) => {
    const result = await fertilizerApplications.getFertilizerApplicationYears();
    return {
      result,
      count: result.length,
    };
  },
});
const fertilizerApplicationSummaryResponseSchema = z.object({
  monthlyApplications: z.array(
    z.object({
      year: z.number(),
      month: z.number(),
      appliedFertilizers: z.array(
        z.object({
          totalAmount: z.number(),
          fertilizerName: z.string(),
          unit: fertilizerUnitSchema,
        }),
      ),
    }),
  ),
});

export const getFertilizerApplicationSummaryForFarmEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({}),
    output: fertilizerApplicationSummaryResponseSchema,
    handler: async ({ input, ctx: { fertilizerApplications, farmId } }) => {
      return fertilizerApplications.getFertilizerApplicationSummaryForFarm(
        farmId,
      );
    },
  });

export const getFertilizerApplicationSummaryForPlotEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({ plotId: z.string() }),
    output: fertilizerApplicationSummaryResponseSchema,
    handler: async ({ input, ctx: { fertilizerApplications } }) => {
      return fertilizerApplications.getFertilizerApplicationSummaryForPlot(
        input.plotId,
      );
    },
  });
