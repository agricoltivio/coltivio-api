import createHttpError from "http-errors";
import { z } from "zod";
import {
  farmEndpointFactory,
  authenticatedEndpointFactory,
} from "../endpoint-factory";

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string().nullable(),
  emailVerified: z.boolean(),
  farmId: z.string().nullable(),
});

const updateUserSchema = z
  .object({
    fullName: z.string().optional(),
    emailVerified: z.boolean().optional(),
    farmId: z.string().optional(),
  })
  .partial();

export const getMyUserProfileEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: userSchema,
  handler: async ({ input, ctx }) => {
    return ctx.users.getUserById(ctx.user.id);
  },
});

export const getUserProfileByIdEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({ userId: z.string() }),
  output: userSchema,
  handler: async ({ input, ctx }) => {
    const user = await ctx.users.getUserById(input.userId);
    if (!user) {
      throw createHttpError(404, "User not found");
    }
    return user;
  },
});

export const getFarmUsersEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(userSchema),
    count: z.number(),
  }),
  handler: async ({ ctx }) => {
    const users = await ctx.farms.getFarmUsers(ctx.farmId);
    return { result: users, count: users.length };
  },
});

export const updateUserProfileEndpoint = authenticatedEndpointFactory.build({
  method: "patch",
  input: updateUserSchema,
  output: userSchema,
  handler: async ({ input, ctx }) => {
    return ctx.users.updateUser(ctx.user.id, input);
  },
});

export const deleteUserProfileEndpoint = authenticatedEndpointFactory.build({
  method: "delete",
  input: z.object({ userId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { userId }, ctx }) => {
    throw new Error("Not implemented");
    return {};
  },
});
