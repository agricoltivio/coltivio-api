CREATE TYPE "public"."forage_conservation_method" AS ENUM('dried', 'silage', 'haylage', 'other', 'none');--> statement-breakpoint
CREATE TYPE "public"."crop_category" AS ENUM('grass', 'grain', 'vegetable', 'fruit', 'other');--> statement-breakpoint
CREATE TYPE "public"."crop_protection_application_method" AS ENUM('spraying', 'misting', 'broadcasting', 'injecting', 'other');--> statement-breakpoint
CREATE TYPE "public"."crop_protection_unit" AS ENUM('ml', 'l', 'g', 'kg');--> statement-breakpoint
CREATE TYPE "public"."fertilization_method" AS ENUM('spray', 'spread', 'other');--> statement-breakpoint
CREATE TYPE "public"."fertilizer_type" AS ENUM('mineral', 'organic');--> statement-breakpoint
CREATE TYPE "public"."fertilizer_unit" AS ENUM('l', 'kg', 'dt', 't', 'm3');--> statement-breakpoint
CREATE TYPE "public"."forage_processing_type" AS ENUM('none', 'square_bale', 'round_bale', 'other');--> statement-breakpoint
CREATE TYPE "public"."tillage_action" AS ENUM('plowing', 'tilling', 'harrowing', 'rolling', 'rotavating', 'weed_harrowing', 'hoeing', 'flame_weeding', 'other');--> statement-breakpoint
CREATE TYPE "public"."tillage_reason" AS ENUM('weed_control', 'soil_loosening', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'USER', 'CONTRACTOR');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crop_protection_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"plot_id" uuid NOT NULL,
	"date_time" timestamp NOT NULL,
	"equipment_id" uuid,
	"product_id" uuid NOT NULL,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"method" "crop_protection_application_method" NOT NULL,
	"amount_per_application" integer NOT NULL,
	"number_of_applications" real NOT NULL,
	"unit" "crop_protection_unit" NOT NULL,
	"additional_notes" text
);
--> statement-breakpoint
ALTER TABLE "crop_protection_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crop_protection_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"method" "crop_protection_application_method" NOT NULL,
	"unit" "crop_protection_unit" NOT NULL,
	"capacity" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crop_protection_equipment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crop_protection_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" "crop_protection_unit" NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "crop_protection_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crop_rotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"plot_id" uuid NOT NULL,
	"crop_id" uuid NOT NULL,
	"sowing_date" date,
	"from_date" date NOT NULL,
	"to_date" date
);
--> statement-breakpoint
ALTER TABLE "crop_rotations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "crop_category" NOT NULL,
	"variety" text,
	"usage_codes" integer[] DEFAULT '{}' NOT NULL,
	"additional_notes" text
);
--> statement-breakpoint
ALTER TABLE "crops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federal_id" text,
	"tvd_id" text,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"location" geometry(Point,4326)
);
--> statement-breakpoint
ALTER TABLE "farms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fertilizer_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"plot_id" uuid NOT NULL,
	"date" date NOT NULL,
	"unit" "fertilizer_unit" NOT NULL,
	"method" "fertilization_method" NOT NULL,
	"amount_per_application" integer NOT NULL,
	"number_of_applications" real NOT NULL,
	"fertilizer_id" uuid NOT NULL,
	"spreader_id" uuid,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"additional_notes" text
);
--> statement-breakpoint
ALTER TABLE "fertilizer_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fertilizer_spreaders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" "fertilizer_unit" NOT NULL,
	"default_method" "fertilization_method" NOT NULL,
	"capacity" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fertilizer_spreaders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fertilizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "fertilizer_type" NOT NULL,
	"unit" "fertilizer_unit" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fertilizers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "harvesting_machinery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"default" boolean DEFAULT false NOT NULL,
	"default_conservation_method" "forage_conservation_method" NOT NULL,
	"default_processing_type" "forage_processing_type" NOT NULL,
	"default_kilos_per_unit" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "harvesting_machinery" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forage_harvests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"date" date NOT NULL,
	"plot_id" uuid NOT NULL,
	"crop_id" uuid NOT NULL,
	"conservation_method" "forage_conservation_method" NOT NULL,
	"processing_type" "forage_processing_type" NOT NULL,
	"kilos_per_unit" real NOT NULL,
	"produced_units" real NOT NULL,
	"harvest_count" integer,
	"machinery_id" uuid,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"additional_notes" text
);
--> statement-breakpoint
ALTER TABLE "forage_harvests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"communal_id" text NOT NULL,
	"gis_id" integer,
	"geometry" geometry(MultiPolygon,4326),
	"size" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parcels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"local_id" text,
	"usage" integer,
	"additional_usages" text,
	"cutting_date" date,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"additional_notes" text
);
--> statement-breakpoint
ALTER TABLE "plots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"farm_id" uuid,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tillage_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"action" "tillage_action" NOT NULL,
	"reason" "tillage_reason" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tillage_equipment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tillages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"plot_id" uuid NOT NULL,
	"geometry" geometry(MultiPolygon,4326) NOT NULL,
	"size" integer NOT NULL,
	"reason" "tillage_reason" NOT NULL,
	"action" "tillage_action" NOT NULL,
	"equipment_id" uuid,
	"date" date NOT NULL,
	"additional_notes" text
);
--> statement-breakpoint
ALTER TABLE "tillages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
 ALTER TABLE "crop_protection_equipment" ADD CONSTRAINT "crop_protection_equipment_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
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
DO $$ BEGIN
 ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crops" ADD CONSTRAINT "crops_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_fertilizer_id_fertilizers_id_fk" FOREIGN KEY ("fertilizer_id") REFERENCES "public"."fertilizers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_spreader_id_fertilizer_spreaders_id_fk" FOREIGN KEY ("spreader_id") REFERENCES "public"."fertilizer_spreaders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizer_spreaders" ADD CONSTRAINT "fertilizer_spreaders_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fertilizers" ADD CONSTRAINT "fertilizers_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
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
 ALTER TABLE "forage_harvests" ADD CONSTRAINT "forage_harvests_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forage_harvests" ADD CONSTRAINT "forage_harvests_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forage_harvests" ADD CONSTRAINT "forage_harvests_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forage_harvests" ADD CONSTRAINT "forage_harvests_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forage_harvests" ADD CONSTRAINT "forage_harvests_machinery_id_harvesting_machinery_id_fk" FOREIGN KEY ("machinery_id") REFERENCES "public"."harvesting_machinery"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parcels" ADD CONSTRAINT "parcels_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plots" ADD CONSTRAINT "plots_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
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
 ALTER TABLE "tillages" ADD CONSTRAINT "tillages_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tillages" ADD CONSTRAINT "tillages_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tillages" ADD CONSTRAINT "tillages_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;
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
CREATE INDEX IF NOT EXISTS "parcel_geometries_idx" ON "parcels" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parcel_gisid_idx" ON "parcels" USING btree ("gis_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plot_geometries_idx" ON "plots" USING gist ("geometry");--> statement-breakpoint
CREATE POLICY "only farm members" ON "crop_protection_applications" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crop_protection_applications"."farm_id" = farm_id()) WITH CHECK ("crop_protection_applications"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "crop_protection_equipment" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crop_protection_equipment"."farm_id" = farm_id()) WITH CHECK ("crop_protection_equipment"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "crop_protection_products" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crop_protection_products"."farm_id" = farm_id()) WITH CHECK ("crop_protection_products"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "crop_rotations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crop_rotations"."farm_id" = farm_id()) WITH CHECK ("crop_rotations"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "crops" AS PERMISSIVE FOR ALL TO "authenticated" USING ("crops"."farm_id" = farm_id()) WITH CHECK ("crops"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "any user can create a new farm" ON "farms" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "only farm members can read" ON "farms" AS PERMISSIVE FOR SELECT TO "authenticated" USING (farm_id() = "farms"."id");--> statement-breakpoint
CREATE POLICY "only farm members can update" ON "farms" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (farm_id() = "farms"."id") WITH CHECK (farm_id() = "farms"."id");--> statement-breakpoint
CREATE POLICY "only farm members can delete" ON "farms" AS PERMISSIVE FOR DELETE TO "authenticated" USING (farm_id() = "farms"."id");--> statement-breakpoint
CREATE POLICY "only farm members" ON "fertilizer_applications" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fertilizer_applications"."farm_id" = farm_id()) WITH CHECK ("fertilizer_applications"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "fertilizer_spreaders" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fertilizer_spreaders"."farm_id" = farm_id()) WITH CHECK ("fertilizer_spreaders"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "fertilizers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fertilizers"."farm_id" = farm_id()) WITH CHECK ("fertilizers"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "harvesting_machinery" AS PERMISSIVE FOR ALL TO "authenticated" USING ("harvesting_machinery"."farm_id" = farm_id()) WITH CHECK ("harvesting_machinery"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "forage_harvests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("forage_harvests"."farm_id" = farm_id()) WITH CHECK ("forage_harvests"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "parcels" AS PERMISSIVE FOR ALL TO "authenticated" USING ("parcels"."farm_id" = farm_id()) WITH CHECK ("parcels"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "plots" AS PERMISSIVE FOR ALL TO "authenticated" USING ("plots"."farm_id" = farm_id()) WITH CHECK ("plots"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "user can insert own profile" ON "profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "profiles"."id");--> statement-breakpoint
CREATE POLICY "user can update own profile" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "profiles"."id");--> statement-breakpoint
CREATE POLICY "members of same farm can read each others profile and owners can read their own profile" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((("profiles"."farm_id" is not null and "profiles"."farm_id" = farm_id()) or (select auth.uid()) = "profiles"."id"));--> statement-breakpoint
CREATE POLICY "only farm members" ON "tillage_equipment" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tillage_equipment"."farm_id" = farm_id()) WITH CHECK ("tillage_equipment"."farm_id" = farm_id());--> statement-breakpoint
CREATE POLICY "only farm members" ON "tillages" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tillages"."farm_id" = farm_id()) WITH CHECK ("tillages"."farm_id" = farm_id());