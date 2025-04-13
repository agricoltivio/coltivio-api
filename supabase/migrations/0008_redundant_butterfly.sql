CREATE TYPE "public"."fertilization_method" AS ENUM('spray', 'spread', 'other');--> statement-breakpoint
ALTER TABLE "fertilizer_applications" RENAME COLUMN "machine_config_id" TO "spreader_id";--> statement-breakpoint
ALTER TABLE "forage_harvests" RENAME COLUMN "machine_config_id" TO "machinery_id";--> statement-breakpoint
ALTER TABLE "fertilizer_applications" DROP CONSTRAINT "fertilizer_applications_machine_config_id_fertilizer_spreaders_id_fk";
--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" DROP CONSTRAINT "fertilizer_spreaders_fertilizer_id_fertilizers_id_fk";
--> statement-breakpoint
ALTER TABLE "forage_harvests" DROP CONSTRAINT "forage_harvests_machine_config_id_harvesting_machinery_id_fk";
--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ADD COLUMN "method" "fertilization_method" NOT NULL;--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" ADD COLUMN "unit" "fertilizer_unit" NOT NULL;--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" ADD COLUMN "default_method" "fertilization_method" NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_spreader_id_fertilizer_spreaders_id_fk" FOREIGN KEY ("spreader_id") REFERENCES "public"."fertilizer_spreaders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forage_harvests" ADD CONSTRAINT "forage_harvests_machinery_id_harvesting_machinery_id_fk" FOREIGN KEY ("machinery_id") REFERENCES "public"."harvesting_machinery"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" DROP COLUMN IF EXISTS "fertilizer_id";