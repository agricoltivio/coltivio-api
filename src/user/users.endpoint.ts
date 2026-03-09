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
  isWikiModerator: z.boolean(),
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
  handler: async ({ ctx }) => {
    const [user, isWikiModerator] = await Promise.all([
      ctx.users.getUserById(ctx.user.id),
      ctx.wikiModeration.isModerator(ctx.user.id),
    ]);
    return { ...user, isWikiModerator };
  },
});

export const getUserProfileByIdEndpoint = authenticatedEndpointFactory.build({
  method: "get",
  input: z.object({ userId: z.string() }),
  output: userSchema,
  handler: async ({ input, ctx }) => {
    const [user, isWikiModerator] = await Promise.all([
      ctx.users.getUserById(input.userId),
      ctx.wikiModeration.isModerator(input.userId),
    ]);
    if (!user) {
      throw createHttpError(404, "User not found");
    }
    return { ...user, isWikiModerator };
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
    const [users, moderatorIds] = await Promise.all([
      ctx.farms.getFarmUsers(ctx.farmId),
      ctx.wikiModeration.getModeratorUserIds(),
    ]);
    const result = users.map((u) => ({
      ...u,
      isWikiModerator: moderatorIds.has(u.id),
    }));
    return { result, count: result.length };
  },
});

export const updateUserProfileEndpoint = authenticatedEndpointFactory.build({
  method: "patch",
  input: updateUserSchema,
  output: userSchema,
  handler: async ({ input, ctx }) => {
    const [user, isWikiModerator] = await Promise.all([
      ctx.users.updateUser(ctx.user.id, input),
      ctx.wikiModeration.isModerator(ctx.user.id),
    ]);
    return { ...user, isWikiModerator };
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
