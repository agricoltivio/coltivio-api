import createHttpError from "http-errors";
import { z } from "zod";
import {
  conservationMethodEnumSchema,
  processingTypeEnumSchema,
} from "../db/schema";
import { farmEndpointFactory } from "../endpoint-factory";

export const harvestingMachinerySchema = z.object({
  id: z.string(),
  farmId: z.string(),
  name: z.string(),
  default: z.boolean(),
  defaultConservationMethod: conservationMethodEnumSchema,
  defaultProcessingType: processingTypeEnumSchema,
  defaultKilosPerUnit: z.number(),
});

const createHarvestingMachinerySchema = z.object({
  name: z.string(),
  default: z.boolean().default(false),
  defaultConservationMethod: conservationMethodEnumSchema,
  defaultProcessingType: processingTypeEnumSchema,
  defaultKilosPerUnit: z.number(),
});

const updateHarvestingMachinerySchema =
  createHarvestingMachinerySchema.partial();

const harvestersResponseSchema = harvestingMachinerySchema;

export const getHarvestingMachineryByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ harvestingMachineryId: z.string() }),
  output: harvestersResponseSchema,
  handler: async ({ input, ctx: { harvestingMachinery } }) => {
    const harvester = await harvestingMachinery.getHarvestingMachineryById(
      input.harvestingMachineryId,
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
  handler: async ({ ctx: { harvestingMachinery, farmId } }) => {
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
  input: createHarvestingMachinerySchema,
  output: harvestersResponseSchema,
  handler: async ({ input, ctx: { harvestingMachinery } }) => {
    return harvestingMachinery.createHarvestingMachinery(input);
  },
});

export const updateHarvestingMachineryEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateHarvestingMachinerySchema.extend({
    harvestingMachineryId: z.string(),
  }),
  output: harvestersResponseSchema,
  handler: async ({ input, ctx: { harvestingMachinery } }) => {
    return harvestingMachinery.updateHarvestingMachinery(
      input.harvestingMachineryId,
      input,
    );
  },
});

export const deleteHarvestingMachineryEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ harvestingMachineryId: z.string() }),
  output: z.object({}),
  handler: async ({
    input: { harvestingMachineryId },
    ctx: { harvestingMachinery },
  }) => {
    await harvestingMachinery.deleteHarvestingMachinery(harvestingMachineryId);
    return {};
  },
});
