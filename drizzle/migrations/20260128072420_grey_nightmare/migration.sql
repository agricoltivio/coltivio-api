CREATE TABLE "animal_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "animal_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outdoor_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"animal_group_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"animal_count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outdoor_journal_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "outdoor_journal_entries_animal_group_id_idx" ON "outdoor_journal_entries" ("animal_group_id");--> statement-breakpoint
CREATE INDEX "outdoor_journal_entries_start_date_idx" ON "outdoor_journal_entries" ("start_date");--> statement-breakpoint
CREATE INDEX "outdoor_journal_entries_end_date_idx" ON "outdoor_journal_entries" ("end_date");--> statement-breakpoint
ALTER TABLE "animal_groups" ADD CONSTRAINT "animal_groups_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_journal_entries" ADD CONSTRAINT "outdoor_journal_entries_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outdoor_journal_entries" ADD CONSTRAINT "outdoor_journal_entries_animal_group_id_animal_groups_id_fkey" FOREIGN KEY ("animal_group_id") REFERENCES "animal_groups"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "only farm members" ON "animal_groups" AS PERMISSIVE FOR ALL TO "authenticated" USING ("animal_groups"."farm_id" = farm_id()) WITH CHECK ("animal_groups"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "outdoor_journal_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("outdoor_journal_entries"."farm_id" = farm_id()) WITH CHECK ("outdoor_journal_entries"."farm_id" = farm_id());