import createHttpError from "http-errors";
import { z } from "zod";
import {
  authenticatedEndpointFactory,
  farmEndpointFactory,
  membershipEndpointFactory,
} from "../endpoint-factory";
import { userSchema } from "../user/users.endpoint";

const inviteSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  email: z.string(),
  createdBy: z.string().nullable(),
  expiresAt: z.string().or(z.date()),
  usedAt: z.string().or(z.date()).nullable(),
});

export const listFarmInvitesEndpoint = farmEndpointFactory.build({
  method: "get",
  input: z.object({}),
  output: z.object({ result: z.array(inviteSchema), count: z.number() }),
  handler: async ({ ctx }) => {
    const result = await ctx.farmInvites.listInvites(ctx.farmId);
    return { result, count: result.length };
  },
});

export const createFarmInviteEndpoint = membershipEndpointFactory.build({
  method: "post",
  input: z.object({ email: z.string().email() }),
  output: inviteSchema,
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can manage invites");
    }
    return ctx.farmInvites.createInvite(ctx.farmId, input.email, ctx.user.id);
  },
});

export const revokeFarmInviteEndpoint = farmEndpointFactory.build({
  method: "delete",
  input: z.object({ inviteId: z.string() }),
  output: z.object({}),
  handler: async ({ input, ctx }) => {
    if (ctx.user.farmRole !== "owner") {
      throw createHttpError(403, "Only farm owners can manage invites");
    }
    await ctx.farmInvites.revokeInvite(input.inviteId);
    return {};
  },
});

export const acceptFarmInviteEndpoint = authenticatedEndpointFactory.build({
  method: "post",
  input: z.object({ code: z.string() }),
  output: userSchema,
  handler: async ({ input, ctx }) => {
    const updatedUser = await ctx.farmInvites.acceptInvite(input.code, ctx.user);
    const isWikiModerator = await ctx.wikiModeration.isModerator(updatedUser.id);
    return { ...updatedUser, isWikiModerator };
  },
});
