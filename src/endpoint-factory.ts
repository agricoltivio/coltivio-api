import { EndpointsFactory, Middleware } from "express-zod-api";
import createHttpError from "http-errors";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { appDrizzle } from "./db/db";
import * as tables from "./db/schema";
import { FarmPermissionFeature } from "./db/schema";
import { sentryResultHandler } from "./sentry";
import { verifyLocalJwt } from "./auth/local-auth";
import { getFeatureAccess } from "./farm/farm-permissions";

const localJwtAuthMiddleware = new Middleware({
  security: {
    type: "header",
    name: "authorization",
  },
  input: z.object({}),
  handler: async ({ input: {}, request, logger: _logger }) => {
    const authorizationHeader = request.headers.authorization;
    if (!authorizationHeader) {
      throw createHttpError(401, "Invalid authorization header");
    }
    const [, jwt] = authorizationHeader.split(" ");
    const payload = verifyLocalJwt(jwt);
    if (!payload) {
      throw createHttpError(401, "Invalid jwt token");
    }
    const user = await appDrizzle.query.profiles.findFirst({
      where: { id: payload.sub },
    });
    if (!user) {
      throw createHttpError(401, "User not found");
    }
    const SUPPORTED_LOCALES = ["de", "en", "it", "fr"] as const;
    const rawLocale = request.headers["accept-language"]?.slice(0, 2);
    const requestLocale = SUPPORTED_LOCALES.includes(rawLocale as (typeof SUPPORTED_LOCALES)[number])
      ? (rawLocale as (typeof SUPPORTED_LOCALES)[number])
      : null;
    if (requestLocale && user.locale !== requestLocale) {
      await appDrizzle.update(tables.profiles).set({ locale: requestLocale }).where(eq(tables.profiles.id, user.id));
      user.locale = requestLocale;
    }
    return { user, token: jwt };
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

export const authenticatedEndpointFactory = publicEndpointFactory.addMiddleware(localJwtAuthMiddleware);

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

// Requires farm membership + feature permission. Owners bypass the check.
export function permissionFarmEndpoint(feature: FarmPermissionFeature, access: "read" | "write") {
  return farmEndpointFactory.addMiddleware(
    new Middleware({
      input: z.object({}),
      handler: async ({ ctx }) => {
        if (ctx.user.farmRole === "owner") return {};
        const userAccess = await getFeatureAccess(ctx.user.id, feature);
        if (userAccess === "none") throw createHttpError(403, `Access denied for: ${feature}`);
        if (access === "write" && userAccess !== "write")
          throw createHttpError(403, `Write access required for: ${feature}`);
        return {};
      },
    })
  );
}

// Internal admin endpoints protected by a static API key.
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
      return {};
    },
  })
);
