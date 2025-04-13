ALTER TABLE "federal_farm_plots" ADD COLUMN "additional_usages" text;--> statement-breakpoint
ALTER TABLE "federal_farm_plots" DROP COLUMN IF EXISTS "additional_usage";