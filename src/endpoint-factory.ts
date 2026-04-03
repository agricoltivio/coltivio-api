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
    return {
      token,
      user,
      ...sessionApi(rlsDb(token, user.farmId), request.t, request.headers["accept-language"] ?? "de"),
    };
  },
});

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
      if (!ctx.user.farmId) {
        throw createHttpError(400, "User has no farm");
      }
      return { farmId: ctx.user.farmId };
    },
  })
);

// Factory for endpoints that require an active farm membership (includes trial)
export const membershipEndpointFactory = farmEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ ctx }) => {
      const active = await ctx.membership.isActive(ctx.farmId);
      if (!active) throw createHttpError(403, "Active membership required");
      return {};
    },
  })
);

// Factory for endpoints that require a paid membership (excludes trial — read-only for trial users)
export const paidMembershipEndpointFactory = farmEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ ctx }) => {
      const paid = await ctx.membership.isPaidMember(ctx.farmId);
      if (!paid) throw createHttpError(403, "Paid membership required");
      return {};
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
      if (ctx.user.farmRole !== "owner") {
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
        if (ctx.user.farmRole === "owner") return {};
        const userAccess = await ctx.farmPermissions.getFeatureAccess(ctx.user.id, feature);
        if (userAccess === "none") throw createHttpError(403, `Access denied for: ${feature}`);
        if (access === "write" && userAccess !== "write")
          throw createHttpError(403, `Write access required for: ${feature}`);
        return {};
      },
    })
  );
}

// Returns a factory that requires active membership (includes trial) + feature permission.
// Use for premium features (contacts, orders, tasks, etc.) that require a subscription.
// Owners bypass the permission check; "none" blocks all access; "write" required for mutations.
export function permissionMembershipEndpoint(feature: FarmPermissionFeature, access: "read" | "write") {
  return membershipEndpointFactory.addMiddleware(
    new Middleware({
      input: z.object({}),
      handler: async ({ ctx }) => {
        if (ctx.user.farmRole === "owner") return {};
        const userAccess = await ctx.farmPermissions.getFeatureAccess(ctx.user.id, feature);
        if (userAccess === "none") throw createHttpError(403, `Access denied for: ${feature}`);
        if (access === "write" && userAccess !== "write")
          throw createHttpError(403, `Write access required for: ${feature}`);
        return {};
      },
    })
  );
}

// Returns a factory that requires paid membership + feature permission.
export function permissionPaidMembershipEndpoint(feature: FarmPermissionFeature, access: "read" | "write") {
  return paidMembershipEndpointFactory.addMiddleware(
    new Middleware({
      input: z.object({}),
      handler: async ({ ctx }) => {
        if (ctx.user.farmRole === "owner") return {};
        const userAccess = await ctx.farmPermissions.getFeatureAccess(ctx.user.id, feature);
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
