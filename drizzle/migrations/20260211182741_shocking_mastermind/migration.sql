CREATE TYPE "animal_usage" AS ENUM('milk', 'other');--> statement-breakpoint
ALTER TABLE "herds" DROP CONSTRAINT "herds_outdoor_schedule_id_outdoor_shedules_id_fkey";--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "usage" "animal_usage" NOT NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "requires_category_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "category_override" "animal_category";--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ADD COLUMN "herd_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "animals" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "herds" DROP COLUMN "outdoor_schedule_id";--> statement-breakpoint
ALTER TABLE "outdoor_shedules" ADD CONSTRAINT "outdoor_shedules_herd_id_herds_id_fkey" FOREIGN KEY ("herd_id") REFERENCES "herds"("id") ON DELETE CASCADE;