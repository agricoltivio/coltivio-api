import createHttpError from "http-errors";
import { z } from "zod";
import { farmEndpointFactory, authenticatedEndpointFactory } from "../endpoint-factory";
import { farmPermissionFeatureSchema } from "../db/schema";
import { getUserById, updateUser } from "./users";
import { getFarmUsers, kickMember, changeMemberRole } from "../farm/farms";
import { listPermissionsForUser } from "../farm/farm-permissions";

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
    const farmPermissions = await listPermissionsForUser(ctx.user.id);
    return { ...ctx.user, isWikiModerator: false, farmPermissions };
  },
});

export const getUserProfileByIdEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({ userId: z.string() }),
  output: userSchema,
  handler: async ({ input, ctx: { farmId } }) => {
    const user = await getUserById(input.userId, farmId);
    if (!user) {
      throw createHttpError(404, "User not found");
    }
    return { ...user, isWikiModerator: false };
  },
});

export const getFarmUsersEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({
    result: z.array(userSchema),
    count: z.number(),
  }),
  handler: async ({ ctx: { farmId } }) => {
    const users = await getFarmUsers(farmId);
    const result = users.map((u) => ({ ...u, isWikiModerator: false }));
    return { result, count: result.length };
  },
});

export const updateUserProfileEndpoint = authenticatedEndpointFactory.build({
  method: "patch",
  input: updateUserSchema,
  output: userSchema,
  handler: async ({ input, ctx }) => {
    const user = await updateUser(ctx.user.id, input);
    return { ...user, isWikiModerator: false };
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
  handler: async ({ input, ctx: { user, farmId } }) => {
    if (user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can kick members");
    }
    await kickMember(input.userId, user.id, farmId);
    return {};
  },
});

export const changeFarmMemberRoleEndpoint = farmEndpointFactory.build({
  method: "patch",
  input: z.object({ userId: z.string(), role: z.enum(["owner", "member"]) }),
  output: userSchema,
  handler: async ({ input, ctx: { user, farmId } }) => {
    if (user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can change member roles");
    }
    const updatedProfile = await changeMemberRole(input.userId, user.id, farmId, input.role);
    return { ...updatedProfile, isWikiModerator: false };
  },
});
