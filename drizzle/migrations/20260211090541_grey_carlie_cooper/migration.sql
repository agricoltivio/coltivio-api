CREATE TYPE "dose_per_unit" AS ENUM('kg', 'animal', 'day', 'total_amount');--> statement-breakpoint
CREATE TYPE "drug_dose_unit" AS ENUM('tablet', 'capsule', 'patch', 'dose', 'mg', 'mcg', 'g', 'ml', 'drop');--> statement-breakpoint
ALTER TABLE "drug_treatment" ADD COLUMN "dose_unit" "drug_dose_unit" NOT NULL;--> statement-breakpoint
ALTER TABLE "drug_treatment" ADD COLUMN "dose_value" real NOT NULL;--> statement-breakpoint
ALTER TABLE "drug_treatment" ADD COLUMN "dose_per_unit" "dose_per_unit" NOT NULL;--> statement-breakpoint
ALTER TABLE "drug_treatment" ADD COLUMN "organs_waiting_days" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "drugs" ADD COLUMN "critical_antibiotic" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "drugs" ADD COLUMN "received_from" text NOT NULL;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "drug_dose_unit" "drug_dose_unit";--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "drug_dose_value" real;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "drug_dose_per_unit" "dose_per_unit";--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "critical_antibiotic" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "antibiogram_available" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "organs_usable_date" date;--> statement-breakpoint
ALTER TABLE "drug_treatment" DROP COLUMN "dose_per_kg_in_ml";