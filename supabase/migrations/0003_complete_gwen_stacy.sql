ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "crop_protection_applications_equipment_id_crop_protection_equipment_id_fk";
--> statement-breakpoint
ALTER TABLE "tillages" DROP CONSTRAINT "tillages_equipment_id_tillage_equipment_id_fk";
--> statement-breakpoint
ALTER TABLE "crop_protection_products" ADD COLUMN "default_equipment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_equipment_id_crop_protection_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."crop_protection_equipment"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_products" ADD CONSTRAINT "crop_protection_products_default_equipment_id_crop_protection_equipment_id_fk" FOREIGN KEY ("default_equipment_id") REFERENCES "public"."crop_protection_equipment"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tillages" ADD CONSTRAINT "tillages_equipment_id_tillage_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."tillage_equipment"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
