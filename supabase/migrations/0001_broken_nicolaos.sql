ALTER TABLE "fertilization_machine_configs" RENAME TO "fertilizer_spreaders";--> statement-breakpoint
ALTER TABLE "forage_harvest-machine-configs" RENAME TO "harvesting_machinery";--> statement-breakpoint
ALTER TABLE "tillage_devices" RENAME TO "tillage_equipment";--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" DROP CONSTRAINT "fertilization_machine_configs_farm_id_farms_id_fk";
--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" DROP CONSTRAINT "fertilization_machine_configs_fertilizer_id_fertilizers_id_fk";
--> statement-breakpoint
ALTER TABLE "fertilizer_applications" DROP CONSTRAINT "fertilizer_applications_machine_config_id_fertilization_machine_configs_id_fk";
--> statement-breakpoint
ALTER TABLE "harvesting_machinery" DROP CONSTRAINT "forage_harvest-machine-configs_farm_id_farms_id_fk";
--> statement-breakpoint
ALTER TABLE "forage_harvests" DROP CONSTRAINT "forage_harvests_machine_config_id_forage_harvest-machine-configs_id_fk";
--> statement-breakpoint
ALTER TABLE "tillage_equipment" DROP CONSTRAINT "tillage_devices_farm_id_farms_id_fk";
--> statement-breakpoint
ALTER TABLE "tillages" DROP CONSTRAINT "tillages_device_id_tillage_devices_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_spreaders" ADD CONSTRAINT "fertilizer_spreaders_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_spreaders" ADD CONSTRAINT "fertilizer_spreaders_fertilizer_id_fertilizers_id_fk" FOREIGN KEY ("fertilizer_id") REFERENCES "public"."fertilizers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_machine_config_id_fertilizer_spreaders_id_fk" FOREIGN KEY ("machine_config_id") REFERENCES "public"."fertilizer_spreaders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "harvesting_machinery" ADD CONSTRAINT "harvesting_machinery_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forage_harvests" ADD CONSTRAINT "forage_harvests_machine_config_id_harvesting_machinery_id_fk" FOREIGN KEY ("machine_config_id") REFERENCES "public"."harvesting_machinery"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tillage_equipment" ADD CONSTRAINT "tillage_equipment_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tillages" ADD CONSTRAINT "tillages_device_id_tillage_equipment_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."tillage_equipment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER POLICY "only farm members" ON "fertilizer_spreaders" TO authenticated USING ("fertilizer_spreaders"."farm_id" = farm_id()) WITH CHECK ("fertilizer_spreaders"."farm_id" = farm_id());--> statement-breakpoint
ALTER POLICY "only farm members" ON "harvesting_machinery" TO authenticated USING ("harvesting_machinery"."farm_id" = farm_id()) WITH CHECK ("harvesting_machinery"."farm_id" = farm_id());--> statement-breakpoint
ALTER POLICY "only farm members" ON "tillage_equipment" TO authenticated USING ("tillage_equipment"."farm_id" = farm_id()) WITH CHECK ("tillage_equipment"."farm_id" = farm_id());