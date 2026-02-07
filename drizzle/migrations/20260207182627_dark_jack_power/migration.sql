ALTER TABLE "crop_protection_application_presets" ALTER COLUMN "method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tillage_presets" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tillages" ALTER COLUMN "reason" DROP NOT NULL;