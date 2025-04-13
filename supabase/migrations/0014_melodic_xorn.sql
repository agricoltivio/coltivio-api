ALTER TABLE "federal_farm_plots" RENAME COLUMN "farm_id" TO "federal_farm_id";--> statement-breakpoint
DROP INDEX IF EXISTS "federal_farm_id_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "federal_farm_id_idx" ON "federal_farm_plots" USING gin ("federal_farm_id" gin_trgm_ops);