ALTER TYPE "public"."plant_protection_application_method" RENAME TO "crop_protection_application_method";--> statement-breakpoint
ALTER TYPE "public"."plant_protection_unit" RENAME TO "crop_protection_unit";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crop_protection_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"method" "crop_protection_application_method" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crop_protection_equipment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plant_protection_applications" RENAME COLUMN "application_method" TO "method";--> statement-breakpoint
ALTER TABLE "tillages" RENAME COLUMN "device_id" TO "equipment_id";--> statement-breakpoint
ALTER TABLE "tillages" DROP CONSTRAINT "tillages_device_id_tillage_equipment_id_fk";
--> statement-breakpoint
ALTER TABLE "plant_protection_applications" ADD COLUMN "equipment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_equipment" ADD CONSTRAINT "crop_protection_equipment_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plant_protection_applications" ADD CONSTRAINT "plant_protection_applications_equipment_id_crop_protection_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."crop_protection_equipment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tillages" ADD CONSTRAINT "tillages_equipment_id_tillage_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."tillage_equipment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE POLICY "only farm members" ON "crop_protection_equipment" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crop_protection_equipment"."farm_id" = farm_id()) WITH CHECK ("crop_protection_equipment"."farm_id" = farm_id());