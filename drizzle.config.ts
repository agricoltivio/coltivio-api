import "dotenv/config";
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  out: "./supabase/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  extensionsFilters: ["postgis"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: "snake_case",
  entities: {
    roles: {
      provider: "supabase",
    },
  },
});
