import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

const harvestersResponseSchema = tables.selectHarvestingMachinerySchema;

export const getHarvestingMachineryByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ harvestingMachineryId: z.string() }),
  output: harvestersResponseSchema,
  handler: async ({ input, options: { harvestingMachinery } }) => {
    const harvester = await harvestingMachinery.getHarvestingMachineryById(
      input.harvestingMachineryId
    );
    if (!harvester) {
      throw createHttpError(404, "Traktor not found");
    }
    return harvester;
  },
});

export const getFarmHarvestingMachineryEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(harvestersResponseSchema),
    count: z.number(),
  }),
  handler: async ({ options: { harvestingMachinery, farmId } }) => {
    const result =
      await harvestingMachinery.getHarvestingMachineryForFarm(farmId);
    return {
      result,
      count: result.length,
    };
  },
});

export const createHarvestingMachineryEndpoint = farmEndpointFactory.build({
  method: "post",
  input: tables.insertHarvestingMachinerySchema.omit({
    farmId: true,
    id: true,
  }),
  output: harvestersResponseSchema,
  handler: async ({ input, options: { harvestingMachinery } }) => {
    return harvestingMachinery.createHarvestingMachinery(input);
  },
});

export const updateHarvestingMachineryEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: tables.updateHarvestingMachinerySchema
    .omit({ id: true, farmId: true })
    .extend({
      harvestingMachineryId: z.string(),
    }),
  output: harvestersResponseSchema,
  handler: async ({ input, options: { harvestingMachinery } }) => {
    return harvestingMachinery.updateHarvestingMachinery(
      input.harvestingMachineryId,
      input
    );
  },
});

export const deleteHarvestingMachineryEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ harvestingMachineryId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { harvestingMachineryId },
    options: { harvestingMachinery },
  }) => {
    await harvestingMachinery.deleteHarvestingMachinery(harvestingMachineryId);
    return {};
  },
});
