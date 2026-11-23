ALTER TYPE "outdoor_schedule_type" ADD VALUE 'stable';--> statement-breakpoint
CREATE TABLE "outdoor_schedule_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"herd_id" uuid NOT NULL,
	"meadow_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"type" "outdoor_schedule_type" NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "outdoor_schedule_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "outdoor_schedule_overrides_herd_id_idx" ON "outdoor_schedule_overrides" ("herd_id");--> statement-breakpoint
CREATE INDEX "outdoor_schedule_overrides_meadow_id_idx" ON "outdoor_schedule_overrides" ("meadow_id");--> statement-breakpoint
ALTER TABLE "outdoor_schedule_overrides" ADD CONSTRAINT "outdoor_schedule_overrides_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_schedule_overrides" ADD CONSTRAINT "outdoor_schedule_overrides_herd_id_herds_id_fkey" FOREIGN KEY ("herd_id") REFERENCES "herds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_schedule_overrides" ADD CONSTRAINT "outdoor_schedule_overrides_meadow_farm_fk" FOREIGN KEY ("meadow_id","farm_id") REFERENCES "meadows"("id","farm_id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "only farm members" ON "outdoor_schedule_overrides" AS PERMISSIVE FOR ALL TO "authenticated" USING ("outdoor_schedule_overrides"."farm_id" = (select farm_id())) WITH CHECK ("outdoor_schedule_overrides"."farm_id" = (select farm_id()));