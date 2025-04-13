ALTER TABLE "crop_protection_applications" ADD COLUMN "amount_per_application" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ADD COLUMN "number_of_applications" real NOT NULL;--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP COLUMN IF EXISTS "applied_amount";