import { z } from "zod";
import createHttpError from "http-errors";
import { publicEndpointFactory, adminApiKeyEndpointFactory } from "../endpoint-factory";
import { appDrizzle } from "../db/db";
import { profiles } from "../db/schema";
import { signLocalJwt, verifyPassword, hashPassword } from "./local-auth";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export const loginEndpoint = publicEndpointFactory.build({
  method: "post",
  input: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
  output: z.object({
    token: z.string(),
  }),
  handler: async ({ input }) => {
    const user = await appDrizzle.query.profiles.findFirst({
      where: { email: input.email },
    });
    if (!user || !user.passwordHash) {
      throw createHttpError(401, "Invalid email or password");
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw createHttpError(401, "Invalid email or password");
    }
    const token = signLocalJwt(user.id, user.farmId ?? null);
    return { token };
  },
});

export const createUserEndpoint = adminApiKeyEndpointFactory.build({
  method: "post",
  input: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().optional(),
  }),
  output: z.object({
    id: z.string(),
    email: z.string(),
  }),
  handler: async ({ input }) => {
    const existing = await appDrizzle.query.profiles.findFirst({
      where: { email: input.email },
    });
    if (existing) {
      throw createHttpError(409, "User with this email already exists");
    }
    const passwordHash = await hashPassword(input.password);
    const [user] = await appDrizzle
      .insert(profiles)
      .values({
        id: uuidv4(),
        email: input.email,
        passwordHash,
        fullName: input.fullName ?? null,
      })
      .returning({ id: profiles.id, email: profiles.email });
    return user;
  },
});

export const changePasswordEndpoint = adminApiKeyEndpointFactory.build({
  method: "patch",
  input: z.object({
    userId: z.string().uuid(),
    password: z.string().min(8),
  }),
  output: z.object({ success: z.boolean() }),
  handler: async ({ input }) => {
    const passwordHash = await hashPassword(input.password);
    await appDrizzle.update(profiles).set({ passwordHash }).where(eq(profiles.id, input.userId));
    return { success: true };
  },
});
