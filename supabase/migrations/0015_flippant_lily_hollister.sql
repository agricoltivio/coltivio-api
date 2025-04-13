ALTER TABLE "federal_farm_plots" RENAME COLUMN "federal_farm_id" TO "farm_id";--> statement-breakpoint
ALTER TABLE "federal_farm_plots" RENAME COLUMN "additional_usages" TO "a_usages";--> statement-breakpoint
DROP INDEX IF EXISTS "federal_farm_id_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "federal_farm_id_idx" ON "federal_farm_plots" USING gin ("farm_id" gin_trgm_ops);