import { EndpointsFactory, Middleware } from "express-zod-api";
import createHttpError from "http-errors";
import { jwtDecode } from "jwt-decode";
import { z } from "zod";
import { sessionApi } from "./api/api";
import { eq } from "drizzle-orm";
import { adminDrizzle, rlsDb } from "./db/db";
import { supabase, SupabaseToken } from "./supabase/supabase";
import * as tables from "./db/schema";
import { FarmPermissionFeature } from "./db/schema";
import { sentryResultHandler } from "./sentry";

export const supabaseAuthMiddleware = new Middleware({
  security: {
    // this information is optional and used for generating documentation
    type: "header",
    name: "authorization",
  },
  input: z.object({}),
  handler: async ({ input: {}, request, logger: _logger }) => {
    const authorizationHeader = request.headers.authorization;
    if (!authorizationHeader) {
      throw createHttpError(401, "Invalid authorization header");
    }
    const [_, jwt] = authorizationHeader.split(" ");
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser(jwt);
    if (!authUser) {
      throw createHttpError(401, "Invalid jwt token, no user found");
    }
    const user = await adminDrizzle.query.profiles.findFirst({
      where: { id: authUser.id },
    });
    if (!user) {
      throw createHttpError(401, "User not found");
    }
    const token = jwtDecode<SupabaseToken>(jwt);
    const SUPPORTED_LOCALES = ["de", "en", "it", "fr"] as const;
    const rawLocale = request.headers["accept-language"]?.slice(0, 2);
    const requestLocale = SUPPORTED_LOCALES.includes(rawLocale as (typeof SUPPORTED_LOCALES)[number])
      ? (rawLocale as (typeof SUPPORTED_LOCALES)[number])
      : null;
    if (requestLocale && user.locale !== requestLocale) {
      await adminDrizzle.update(tables.profiles).set({ locale: requestLocale }).where(eq(tables.profiles.id, user.id));
      user.locale = requestLocale;
    }

    const farmContext = await resolveFarmContext(request.headers["x-farm-id"], user.id);

    return {
      token,
      user,
      farmContext,
      ...sessionApi(rlsDb(token, farmContext.farmId), request.t, request.headers["accept-language"] ?? "de"),
    };
  },
});

export type FarmContext = {
  farmId: string | null;
  farmRole: "owner" | "member" | null;
  // true when the user belongs to 2+ farms and didn't specify which one via the x-farm-id header
  ambiguous: boolean;
};

const uuidSchema = z.string().uuid();

// Resolves which farm a request operates on. Never trusts the header blindly — it's always
// checked against farm_members. Falls back to auto-selecting the user's only farm when the
// header is omitted, which is what keeps every existing single-farm client working unchanged.
async function resolveFarmContext(farmIdHeader: string | string[] | undefined, userId: string): Promise<FarmContext> {
  const requestedFarmId = typeof farmIdHeader === "string" ? farmIdHeader : undefined;
  if (requestedFarmId !== undefined && !uuidSchema.safeParse(requestedFarmId).success) {
    throw createHttpError(400, "Invalid x-farm-id header");
  }

  const memberships = await adminDrizzle.query.farmMembers.findMany({ where: { userId } });

  if (requestedFarmId) {
    const match = memberships.find((m) => m.farmId === requestedFarmId);
    if (!match) {
      throw createHttpError(403, "You are not a member of the specified farm");
    }
    return { farmId: match.farmId, farmRole: match.role, ambiguous: false };
  }

  if (memberships.length === 1) {
    return { farmId: memberships[0].farmId, farmRole: memberships[0].role, ambiguous: false };
  }

  if (memberships.length > 1) {
    return { farmId: null, farmRole: null, ambiguous: true };
  }

  return { farmId: null, farmRole: null, ambiguous: false };
}

const sentryEndpointFactory = new EndpointsFactory(sentryResultHandler);

export const publicEndpointFactory = sentryEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ input: {}, request, logger: _logger }) => {
      const preferredLanguage = request.headers["accept-language"] ?? "de";
      return { preferredLanguage };
    },
  })
);

export const authenticatedEndpointFactory = publicEndpointFactory.addMiddleware(supabaseAuthMiddleware);

export const farmEndpointFactory = authenticatedEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ input: {}, request: _request, logger: _logger, ctx }) => {
      if (ctx.farmContext.ambiguous) {
        throw createHttpError(400, "You belong to multiple farms; specify the X-Farm-Id header");
      }
      if (!ctx.farmContext.farmId) {
        throw createHttpError(400, "User has no farm");
      }
      return { farmId: ctx.farmContext.farmId, farmRole: ctx.farmContext.farmRole };
    },
  })
);

// Factories for endpoints that require membership but NOT a farm (e.g. the platform-wide forum).
// Membership is checked per-user rather than per-farm.
export const userMembershipEndpointFactory = authenticatedEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ ctx }) => {
      const active = await ctx.membership.isActiveUser(ctx.user.id);
      if (!active) throw createHttpError(403, "Active membership required");
      return {};
    },
  })
);

export const userPaidMembershipEndpointFactory = authenticatedEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ ctx }) => {
      const paid = await ctx.membership.isPaidUser(ctx.user.id);
      if (!paid) throw createHttpError(403, "Paid membership required");
      return {};
    },
  })
);

// Factory for endpoints that are exclusively for farm owners (not members).
export const ownerOnlyEndpointFactory = farmEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ ctx }) => {
      if (ctx.farmRole !== "owner") {
        throw createHttpError(403, "Only farm owners can perform this action");
      }
      return {};
    },
  })
);

// Returns a factory that requires farm membership (no subscription needed) + feature permission.
// Use for core agricultural features (animals, plots, crops, etc.) that all farm members can access.
// Owners bypass the permission check; "none" blocks all access; "write" required for mutations.
export function permissionFarmEndpoint(feature: FarmPermissionFeature, access: "read" | "write") {
  return farmEndpointFactory.addMiddleware(
    new Middleware({
      input: z.object({}),
      handler: async ({ ctx }) => {
        if (ctx.farmRole === "owner") return {};
        const userAccess = await ctx.farmPermissions.getFeatureAccess(ctx.user.id, ctx.farmId, feature);
        if (userAccess === "none") throw createHttpError(403, `Access denied for: ${feature}`);
        if (access === "write" && userAccess !== "write")
          throw createHttpError(403, `Write access required for: ${feature}`);
        return {};
      },
    })
  );
}

// Factory for internal admin endpoints protected by a static API key (from env ADMIN_API_KEY).
// Used for operations that don't go through Supabase auth (e.g. promoting wiki moderators).
export const adminApiKeyEndpointFactory = sentryEndpointFactory.addMiddleware(
  new Middleware({
    security: {
      type: "header",
      name: "x-admin-api-key",
    },
    input: z.object({}),
    handler: async ({ request }) => {
      const expectedKey = process.env.ADMIN_API_KEY;
      if (!expectedKey) {
        throw createHttpError(500, "ADMIN_API_KEY env var not configured");
      }
      const providedKey = request.headers["x-admin-api-key"];
      if (providedKey !== expectedKey) {
        throw createHttpError(401, "Invalid admin API key");
      }
      return { adminDrizzle };
    },
  })
);
