CREATE TABLE "herd_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"herd_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date
);
--> statement-breakpoint
ALTER TABLE "herd_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "herd_memberships_animal_id_idx" ON "herd_memberships" ("animal_id");--> statement-breakpoint
CREATE INDEX "herd_memberships_herd_id_idx" ON "herd_memberships" ("herd_id");--> statement-breakpoint
ALTER TABLE "herd_memberships" ADD CONSTRAINT "herd_memberships_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "herd_memberships" ADD CONSTRAINT "herd_memberships_animal_id_animals_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "herd_memberships" ADD CONSTRAINT "herd_memberships_herd_id_herds_id_fkey" FOREIGN KEY ("herd_id") REFERENCES "herds"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "only farm members" ON "herd_memberships" AS PERMISSIVE FOR ALL TO "authenticated" USING ("herd_memberships"."farm_id" = farm_id()) WITH CHECK ("herd_memberships"."farm_id" = farm_id());