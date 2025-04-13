import { ez } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

const fertilizerApplicationResponseSchema =
  tables.selectFertilizerApplicationSchema.merge(
    z.object({
      createdAt: ez.dateOut(),
      date: ez.dateOut(),
      geometry: tables.multiPolygonSchema,
      plot: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
      }),
      spreader: tables.selectFertilizerSpreaderSchema.nullable(),
      fertilizer: tables.selectFertilizerSchema,
    })
  );

export const getFertilizerApplicationsForFarmEndpoint =
  farmEndpointFactory.build({
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
      result: z.array(fertilizerApplicationResponseSchema),
      count: z.number(),
    }),
    handler: async ({ input, options: { fertilizerApplications, farmId } }) => {
      const result =
        await fertilizerApplications.getFertilizerApplicationsForFarm(
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

export const getFertilizerApplicationsForPlotEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({ plotId: z.string() }),
    output: z.object({
      result: fertilizerApplicationResponseSchema.omit({ plot: true }).array(),
      count: z.number(),
    }),
    handler: async ({ input, options: { fertilizerApplications } }) => {
      const result =
        await fertilizerApplications.getFertilizerApplicationsForPlot(
          input.plotId
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
  handler: async ({ input, options: { fertilizerApplications } }) => {
    const fertilizerApplication =
      await fertilizerApplications.getFertilizerApplicationById(
        input.fertilizerApplicationId
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
    unit: tables.fertilizerUnitSchema,
    method: tables.fertilizationMethodSchema,
    amountPerApplication: z.number(),
    fertilizerId: z.string(),
    spreaderId: z.string().optional(),
    additionalNotes: z.string().optional(),
    plots: z
      .object({
        plotId: z.string(),
        numberOfApplications: z.number(),
        geometry: tables.multiPolygonSchema,
        size: z.number(),
      })
      .array(),
  }),
  output: z.object({
    result: fertilizerApplicationResponseSchema.array(),
    count: z.number(),
  }),
  handler: async ({ input, options: { user, fertilizerApplications } }) => {
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
  handler: async ({ input, options: { fertilizerApplications } }) => {
    await fertilizerApplications.deleteFertilizerApplication(
      input.fertilizerApplicationId
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
  handler: async ({ options: { fertilizerApplications } }) => {
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
          unit: tables.fertilizerUnitSchema,
        })
      ),
    })
  ),
});

export const getFertilizerApplicationSummaryForFarmEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({}),
    output: fertilizerApplicationSummaryResponseSchema,
    handler: async ({ input, options: { fertilizerApplications, farmId } }) => {
      return fertilizerApplications.getFertilizerApplicationSummaryForFarm(
        farmId
      );
    },
  });

export const getFertilizerApplicationSummaryForPlotEndpoint =
  farmEndpointFactory.build({
    method: "get",
    input: z.object({ plotId: z.string() }),
    output: fertilizerApplicationSummaryResponseSchema,
    handler: async ({ input, options: { fertilizerApplications } }) => {
      return fertilizerApplications.getFertilizerApplicationSummaryForPlot(
        input.plotId
      );
    },
  });
