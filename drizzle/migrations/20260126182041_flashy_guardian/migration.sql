CREATE TABLE "drug_treatment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"drug_id" uuid NOT NULL,
	"animal_type" "animal_type" NOT NULL,
	"dose_per_kg" real NOT NULL,
	"milk_waiting_days" integer NOT NULL,
	"meat_waiting_days" integer NOT NULL,
	CONSTRAINT "drug_treatment_drug_animal_unique" UNIQUE("drug_id","animal_type")
);
--> statement-breakpoint
ALTER TABLE "drug_treatment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "drugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "drugs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"drug_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"milk_usable_date" date,
	"meat_usable_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "treatments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "animals" ALTER COLUMN "date_of_birth" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "drug_treatment_drug_id_idx" ON "drug_treatment" ("drug_id");--> statement-breakpoint
CREATE INDEX "treatments_animal_id_idx" ON "treatments" ("animal_id");--> statement-breakpoint
CREATE INDEX "treatments_drug_id_idx" ON "treatments" ("drug_id");--> statement-breakpoint
CREATE INDEX "treatments_date_idx" ON "treatments" ("date");--> statement-breakpoint
ALTER TABLE "drug_treatment" ADD CONSTRAINT "drug_treatment_drug_id_drugs_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "drugs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drugs" ADD CONSTRAINT "drugs_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_drug_id_drugs_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "drugs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "only farm members" ON "drug_treatment" AS PERMISSIVE FOR ALL TO "authenticated" USING (EXISTS (
        SELECT 1 FROM "drugs"
        WHERE "drugs"."id" = "drug_treatment"."drug_id"
        AND "drugs"."farm_id" = current_setting('request.farm_id')::uuid
      ));--> statement-breakpoint
CREATE POLICY "only farm members" ON "drugs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("drugs"."farm_id" = farm_id()) WITH CHECK ("drugs"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "treatments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("treatments"."farm_id" = farm_id()) WITH CHECK ("treatments"."farm_id" = farm_id());