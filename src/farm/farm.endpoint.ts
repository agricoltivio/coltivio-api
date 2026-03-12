import createHttpError from "http-errors";
import { z } from "zod";
import {
  authenticatedEndpointFactory,
  farmEndpointFactory,
} from "../endpoint-factory";

const pointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const farmSchema = z.object({
  id: z.string(),
  federalId: z.string().nullable(),
  tvdId: z.string().nullable(),
  name: z.string(),
  address: z.string(),
  location: pointSchema,
});

const createFarmSchema = z.object({
  name: z.string(),
  federalId: z.string().optional().nullable(),
  address: z.string(),
  location: pointSchema,
});

const updateFarmSchema = z.object({
  name: z.string().optional(),
  location: pointSchema.optional(),
  address: z.string().optional(),
  federalId: z.string().optional(),
  tvdId: z.string().optional(),
});

export const getFarmEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: farmSchema,
  handler: async ({ input, ctx }) => {
    const farm = await ctx.farms.getFarmById(ctx.farmId);
    if (!farm) {
      throw createHttpError(404, "Farm not found");
    }

    return farm;
  },
});

export const createFarmEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: createFarmSchema,
  output: farmSchema,
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmId != null) {
      throw createHttpError(400, "User already has a farm");
    }
    return ctx.farms.createFarm(ctx.user.id, input);
  },
});

export const updateFarmEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateFarmSchema,
  output: farmSchema,
  handler: async ({ input, ctx }) => {
    return ctx.farms.updateFarm(ctx.farmId, input);
  },
});

export const deleteFarmEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({
    deleteAccount: z.string().transform((value) => value === "true"),
  }),
  output: z.object({}),
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can delete the farm");
    }
    await ctx.farms.deleteFarm(ctx.farmId);
    if (input.deleteAccount) {
      await ctx.users.deleteUser(ctx.user.id);
    }
    return {};
  },
});
