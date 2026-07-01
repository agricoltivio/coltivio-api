import { drizzle } from "drizzle-orm/postgres-js";
import { relations } from "./schema";

export const appDrizzle = drizzle(process.env.DATABASE_URL!, {
  relations,
});

export type AppDb = typeof appDrizzle;
export type Transaction = Parameters<Parameters<typeof appDrizzle.transaction>[0]>[0];

// No-op in rc.4 — drizzle manages the connection pool internally
export async function disconnect(): Promise<void> {}
