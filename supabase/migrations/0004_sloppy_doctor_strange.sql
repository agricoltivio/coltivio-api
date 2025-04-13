ALTER TABLE "plant_protection_applications" RENAME TO "crop_protection_applications";--> statement-breakpoint
ALTER TABLE "plant_protection_products" RENAME TO "crop_protection_products";--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "plant_protection_applications_farm_id_farms_id_fk";
--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "plant_protection_applications_created_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "plant_protection_applications_plot_id_plots_id_fk";
--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "plant_protection_applications_equipment_id_crop_protection_equipment_id_fk";
--> statement-breakpoint
ALTER TABLE "crop_protection_applications" DROP CONSTRAINT "plant_protection_applications_product_id_plant_protection_products_id_fk";
--> statement-breakpoint
ALTER TABLE "crop_protection_products" DROP CONSTRAINT "plant_protection_products_farm_id_farms_id_fk";
--> statement-breakpoint
ALTER TABLE "crop_protection_products" ADD COLUMN "unit" "crop_protection_unit" NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_equipment_id_crop_protection_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."crop_protection_equipment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_applications" ADD CONSTRAINT "crop_protection_applications_product_id_crop_protection_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."crop_protection_products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_protection_products" ADD CONSTRAINT "crop_protection_products_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER POLICY "only farm members" ON "crop_protection_applications" TO authenticated USING ("crop_protection_applications"."farm_id" = farm_id()) WITH CHECK ("crop_protection_applications"."farm_id" = farm_id());--> statement-breakpoint
ALTER POLICY "only farm members" ON "crop_protection_products" TO authenticated USING ("crop_protection_products"."farm_id" = farm_id()) WITH CHECK ("crop_protection_products"."farm_id" = farm_id());