ALTER TABLE "drug_treatment" RENAME COLUMN "dose_per_kg" TO "dose_per_kg_in_ml";--> statement-breakpoint
ALTER TABLE "treatments" DROP COLUMN "reason";