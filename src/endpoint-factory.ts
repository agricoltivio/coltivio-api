import {
  defaultEndpointsFactory,
  EndpointsFactory,
  Middleware,
} from "express-zod-api";
import createHttpError from "http-errors";
import { jwtDecode } from "jwt-decode";
import { z } from "zod";
import { sessionApi } from "./api/api";
import { adminDrizzle, rlsDb } from "./db/db";
import { supabase, SupabaseToken } from "./supabase/supabase";
import * as tables from "./db/schema";
import { sentryResultHandler } from "./sentry";

export const supabaseAuthMiddleware = new Middleware({
  security: {
    // this information is optional and used for generating documentation
    type: "header",
    name: "authorization",
  },
  input: z.object({}),
  handler: async ({ input: {}, request, logger }) => {
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
    return {
      token,
      user,
      ...sessionApi(
        rlsDb(token, user.farmId),
        request.t,
        request.headers["accept-language"] ?? "de"
      ),
    };
  },
});

const sentryEndpointFactory = new EndpointsFactory(sentryResultHandler);

export const publicEndpointFactory = sentryEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ input: {}, request, logger }) => {
      const preferredLanguage = request.headers["accept-language"] ?? "de";
      return { preferredLanguage };
    },
  })
);

export const authenticatedEndpointFactory = publicEndpointFactory.addMiddleware(
  supabaseAuthMiddleware
);

export const farmEndpointFactory = authenticatedEndpointFactory.addMiddleware(
  new Middleware({
    input: z.object({}),
    handler: async ({ input: {}, request, logger, ctx }) => {
      if (!ctx.user.farmId) {
        throw createHttpError(400, "User has no farm");
      }
      return { farmId: ctx.user.farmId };
    },
  })
);
