ALTER TABLE "fertilizer_applications" ALTER COLUMN "unit" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" ALTER COLUMN "unit" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "fertilizers" ALTER COLUMN "unit" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."fertilizer_unit";--> statement-breakpoint
CREATE TYPE "public"."fertilizer_unit" AS ENUM('l', 'kg', 'dt', 't');--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ALTER COLUMN "unit" SET DATA TYPE "public"."fertilizer_unit" USING "unit"::"public"."fertilizer_unit";--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" ALTER COLUMN "unit" SET DATA TYPE "public"."fertilizer_unit" USING "unit"::"public"."fertilizer_unit";--> statement-breakpoint
ALTER TABLE "fertilizers" ALTER COLUMN "unit" SET DATA TYPE "public"."fertilizer_unit" USING "unit"::"public"."fertilizer_unit";--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ALTER COLUMN "amount_per_application" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ALTER COLUMN "amount_per_application" SET DATA TYPE real;