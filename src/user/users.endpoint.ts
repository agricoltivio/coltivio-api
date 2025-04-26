import createHttpError from "http-errors";
import { z } from "zod";
import * as tables from "../db/schema";
import {
  farmEndpointFactory,
  authenticatedEndpointFactory,
} from "../endpoint-factory";

export const getMyUserProfileEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: tables.selectUserSchema,
  handler: async ({ input, options }) => {
    return options.users.getUserById(options.user.id);
  },
});

export const getUserProfileByIdEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({ userId: z.string() }),
  output: tables.selectUserSchema,
  handler: async ({ input, options }) => {
    const user = await options.users.getUserById(input.userId);
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
    result: z.array(tables.selectUserSchema),
    count: z.number(),
  }),
  handler: async ({ options }) => {
    const users = await options.farms.getFarmUsers(options.farmId);
    return { result: users, count: users.length };
  },
});

export const updateUserProfileEndpoint = authenticatedEndpointFactory.build({
  method: "patch",
  input: tables.updateUserSchema.omit({ id: true }),
  output: tables.selectUserSchema,
  handler: async ({ input, options }) => {
    return options.users.updateUser(options.user.id, input);
  },
});

export const deleteUserProfileEndpoint = authenticatedEndpointFactory.build({
  method: "delete",
  input: z.object({ userId: z.string() }),
  output: z.object({}),
  handler: async ({ input: { userId }, options }) => {
    throw new Error("Not implemented");
    return {};
  },
});
