ALTER TABLE "farms" ALTER COLUMN "federal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "federal_farm_plots" ADD COLUMN "additional_usage" integer;