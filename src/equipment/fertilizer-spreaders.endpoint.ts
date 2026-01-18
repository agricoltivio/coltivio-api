import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const getFertilizerSpreaderByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ fertilizerSpreaderId: z.string() }),
  output: tables.selectFertilizerSpreaderSchema,
  handler: async ({
    input,
    ctx: { fertilizerSpreader: fertilizerSpreaders },
  }) => {
    const fertilizerSpreader =
      await fertilizerSpreaders.getFertilizerSpreaderById(
        input.fertilizerSpreaderId
      );
    if (!fertilizerSpreader) {
      throw createHttpError(404, "FertilizerSpreader not found");
    }
    return fertilizerSpreader;
  },
});

export const getFarmFertilizerSpreadersEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(tables.selectFertilizerSpreaderSchema),
    count: z.number(),
  }),
  handler: async ({
    ctx: { fertilizerSpreader: fertilizerSpreaders, farmId },
  }) => {
    const result =
      await fertilizerSpreaders.getFertilizerSpreadersForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createFertilizerSpreaderEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertFertilizerSpreaderSchema.omit({
    farmId: true,
    id: true,
  }),
  output: tables.selectFertilizerSpreaderSchema,
  handler: async ({
    input,
    ctx: { fertilizerSpreader: fertilizerSpreaders },
  }) => {
    return fertilizerSpreaders.createFertilizerSpreader(input);
  },
});

export const updateFertilizerSpreaderEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateFertilizerSpreaderSchema
    .omit({ id: true, farmId: true })
    .extend({
      fertilizerSpreaderId: z.string(),
    }),
  output: tables.selectFertilizerSpreaderSchema,
  handler: async ({
    input,
    ctx: { fertilizerSpreader: fertilizerSpreaders },
  }) => {
    return fertilizerSpreaders.updateFertilizerSpreader(
      input.fertilizerSpreaderId,
      input
    );
  },
});

export const deleteFertilizerSpreaderEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ fertilizerSpreaderId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { fertilizerSpreaderId },
    ctx: { fertilizerSpreader: fertilizerSpreader },
  }) => {
    await fertilizerSpreader.deleteFertilizerSpreader(fertilizerSpreaderId);
    return {};
  },
});
