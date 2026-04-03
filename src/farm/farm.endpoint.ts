import createHttpError from "http-errors";
import { z } from "zod";
import { authenticatedEndpointFactory, farmEndpointFactory } from "../endpoint-factory";

const pointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

const farmBaseSchema = z.object({
  id: z.string(),
  federalId: z.string().nullable(),
  tvdId: z.string().nullable(),
  name: z.string(),
  address: z.string(),
  location: pointSchema,
});

export const farmSchema = farmBaseSchema.extend({
  membership: z.object({ status: z.enum(["none", "trial", "active"]) }),
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
  handler: async ({ ctx }) => {
    const [farm, status] = await Promise.all([
      ctx.farms.getFarmById(ctx.farmId),
      ctx.membership.getFarmMembershipStatus(ctx.farmId),
    ]);
    if (!farm) {
      throw createHttpError(404, "Farm not found");
    }

    return { ...farm, membership: { status } };
  },
});

export const createFarmEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: createFarmSchema,
  output: farmBaseSchema,
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
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can update farm settings");
    }
    const [farm, status] = await Promise.all([
      ctx.farms.updateFarm(ctx.farmId, input),
      ctx.membership.getFarmMembershipStatus(ctx.farmId),
    ]);
    return { ...farm, membership: { status } };
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
