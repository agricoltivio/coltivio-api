import createHttpError from "http-errors";
import { z } from "zod";
import { authenticatedEndpointFactory, farmEndpointFactory } from "../endpoint-factory";
import { createFarm, deleteFarm, getFarmById, updateFarm } from "./farms";
import { deleteUser } from "../user/users";
import i18next from "i18next";

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
  membership: z.object({ status: z.enum(["none", "trial", "active"]) }).optional(),
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
  handler: async ({ ctx: { farmId } }) => {
    const farm = await getFarmById(farmId);
    if (!farm) {
      throw createHttpError(404, "Farm not found");
    }
    return farm;
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
    const t = i18next.getFixedT(ctx.preferredLanguage);
    return createFarm(ctx.user.id, input, t);
  },
});

export const updateFarmEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: updateFarmSchema,
  output: farmSchema,
  handler: async ({ input, ctx: { user, farmId } }) => {
    if (user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can update farm settings");
    }
    return updateFarm(farmId, input);
  },
});

export const deleteFarmEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({
    deleteAccount: z.string().transform((value) => value === "true"),
  }),
  output: z.object({}),
  handler: async ({ input, ctx: { user, farmId } }) => {
    if (user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can delete the farm");
    }
    await deleteFarm(farmId);
    if (input.deleteAccount) {
      await deleteUser(user.id);
    }
    return {};
  },
});
