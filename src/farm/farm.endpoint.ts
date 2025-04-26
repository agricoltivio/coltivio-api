import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import {
  authenticatedEndpointFactory,
  farmEndpointFactory,
} from "../endpoint-factory";

export const getFarmEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: tables.selectFarmSchema,
  handler: async ({ input, options }) => {
    const farm = await options.farms.getFarmById(options.farmId);
    if (!farm) {
      throw createHttpError(404, "Farm not found");
    }

    return farm;
  },
});

export const createFarmEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: z.object({
    name: z.string(),
    federalId: z.string().optional().nullable(),
    address: z.string(),
    location: tables.pointSchema,
  }),
  output: tables.selectFarmSchema,
  handler: async ({ input, options }) => {
    if (options.user.farmId != null) {
      throw createHttpError(400, "User already has a farm");
    }
    return options.farms.createFarm(options.user.id, input);
  },
});

export const updateFarmEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: z.object({
    name: z.string().optional(),
    location: tables.pointSchema.optional(),
    address: z.string().optional(),
    federalId: z.string().optional(),
    tvdId: z.string().optional(),
  }),
  output: tables.selectFarmSchema,
  handler: async ({ input, options }) => {
    return options.farms.updateFarm(options.farmId, input);
  },
});

export const deleteFarmEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({
    deleteAccount: z.string().transform((value) => value === "true"),
  }),
  output: z.object({}),
  handler: async ({ input, options }) => {
    await options.farms.deleteFarm(options.farmId);
    if (input.deleteAccount) {
      await options.users.deleteUser(options.user.id);
    }
    return {};
  },
});
