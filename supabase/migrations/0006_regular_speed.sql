ALTER TABLE "crop_protection_equipment" ADD COLUMN "unit" "crop_protection_unit" NOT NULL;--> statement-breakpoint
ALTER TABLE "crop_protection_equipment" ADD COLUMN "capacity" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."crop_protection_applications" ALTER COLUMN "method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."crop_protection_equipment" ALTER COLUMN "method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."crop_protection_application_method";--> statement-breakpoint
CREATE TYPE "public"."crop_protection_application_method" AS ENUM('spraying', 'misting', 'broadcasting', 'injecting', 'other');--> statement-breakpoint
ALTER TABLE "public"."crop_protection_applications" ALTER COLUMN "method" SET DATA TYPE "public"."crop_protection_application_method" USING "method"::"public"."crop_protection_application_method";--> statement-breakpoint
ALTER TABLE "public"."crop_protection_equipment" ALTER COLUMN "method" SET DATA TYPE "public"."crop_protection_application_method" USING "method"::"public"."crop_protection_application_method";