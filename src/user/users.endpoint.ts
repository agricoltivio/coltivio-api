import createHttpError from "http-errors";
import { z } from "zod";
import { farmEndpointFactory, authenticatedEndpointFactory } from "../endpoint-factory";
import { farmPermissionFeatureSchema } from "../db/schema";

const farmPermissionSchema = z.object({
  feature: farmPermissionFeatureSchema,
  access: z.enum(["none", "read", "write"]),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string().nullable(),
  emailVerified: z.boolean(),
  farmId: z.string().nullable(),
  farmRole: z.enum(["owner", "member"]).nullable(),
  isWikiModerator: z.boolean(),
});

// Extended schema for GET /me — includes the caller's explicit permission grants.
// Owners always have full access so farmPermissions is empty for them.
// Members default to "none" for unlisted features.
const myProfileSchema = userSchema.extend({
  farmPermissions: z.array(farmPermissionSchema),
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
  output: myProfileSchema,
  handler: async ({ ctx }) => {
    const [user, isWikiModerator, farmPermissions] = await Promise.all([
      ctx.users.getUserById(ctx.user.id),
      ctx.wikiModeration.isModerator(ctx.user.id),
      ctx.farmPermissions.listPermissionsForUser(ctx.user.id),
    ]);
    return { ...user, isWikiModerator, farmPermissions };
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
  handler: async ({ input: { userId: _userId }, ctx: _ctx }) => {
    throw new Error("Not implemented");
    return {};
  },
});

export const kickFarmMemberEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ userId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can kick members");
    }
    await ctx.farms.kickMember(input.userId, ctx.user.id, ctx.farmId);
    return {};
  },
});

export const changeFarmMemberRoleEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: z.object({ userId: z.string(), role: z.enum(["owner", "member"]) }),
  output: userSchema,
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can change member roles");
    }
    const [updatedProfile, isWikiModerator] = await Promise.all([
      ctx.farms.changeMemberRole(input.userId, ctx.user.id, ctx.farmId, input.role),
      ctx.wikiModeration.isModerator(input.userId),
    ]);
    return { ...updatedProfile, isWikiModerator };
  },
});
