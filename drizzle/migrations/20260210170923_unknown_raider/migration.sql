CREATE TABLE "animal_treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"animal_id" uuid NOT NULL,
	"treatment_id" uuid NOT NULL,
	"farm_id" uuid NOT NULL,
	CONSTRAINT "animal_treatments_unique" UNIQUE("animal_id","treatment_id")
);
--> statement-breakpoint
ALTER TABLE "animal_treatments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "treatments" DROP CONSTRAINT "treatments_animal_id_animals_id_fkey";--> statement-breakpoint
DROP INDEX "treatments_animal_id_idx";--> statement-breakpoint
ALTER TABLE "treatments" DROP COLUMN "animal_id";--> statement-breakpoint
CREATE INDEX "animal_treatments_animal_id_idx" ON "animal_treatments" ("animal_id");--> statement-breakpoint
CREATE INDEX "animal_treatments_treatment_id_idx" ON "animal_treatments" ("treatment_id");--> statement-breakpoint
ALTER TABLE "animal_treatments" ADD CONSTRAINT "animal_treatments_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_treatments" ADD CONSTRAINT "animal_treatments_treatment_id_treatments_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "treatments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "animal_treatments" ADD CONSTRAINT "animal_treatments_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "only farm members" ON "animal_treatments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("animal_treatments"."farm_id" = farm_id()) WITH CHECK ("animal_treatments"."farm_id" = farm_id());