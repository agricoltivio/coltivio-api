CREATE TABLE "sponsorship_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"yearly_cost" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsorship_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD COLUMN "sponsorship_type_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsorship_types" ADD CONSTRAINT "sponsorship_types_farm_id_farms_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_sponsorship_type_id_sponsorship_types_id_fkey" FOREIGN KEY ("sponsorship_type_id") REFERENCES "sponsorship_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE POLICY "only farm members" ON "sponsorship_types" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sponsorship_types"."farm_id" = farm_id()) WITH CHECK ("sponsorship_types"."farm_id" = farm_id());